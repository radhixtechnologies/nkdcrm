const { pool } = require('../config/database');

async function initDpr() {
    console.log('--- Initializing DPR (Daily Progress Report) Schema ---');

    // 1. Create table daily_progress_reports
    await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_progress_reports (
            dpr_id SERIAL PRIMARY KEY,
            report_no VARCHAR(100) UNIQUE NOT NULL,
            site_id INTEGER REFERENCES sites(site_id) ON DELETE CASCADE,
            report_date DATE NOT NULL,
            client_name VARCHAR(150),
            contractor_name VARCHAR(150) DEFAULT 'NKD POWER SOLUTIONS PVT LTD',
            po_number VARCHAR(100),
            po_value NUMERIC(15, 2) DEFAULT 0,
            current_billing_value NUMERIC(15, 2) DEFAULT 0,
            billing_progress_pct NUMERIC(5, 2) DEFAULT 0,
            start_date DATE,
            completion_date DATE,
            today_activities JSONB DEFAULT '[]'::jsonb,
            next_day_activities JSONB DEFAULT '[]'::jsonb,
            show_stoppers JSONB DEFAULT '[]'::jsonb,
            manpower_data JSONB DEFAULT '[]'::jsonb,
            photos JSONB DEFAULT '[]'::jsonb,
            created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Ensure Site 1 exists (GTPL LUMINA, AIROLI, MUMBAI) with client LUMINA
    const siteCheck = await pool.query("SELECT site_id FROM sites WHERE site_name ILIKE '%Lumina%' OR site_code = 'GTPL-LUMINA'");
    let luminaSiteId;
    if (siteCheck.rows.length === 0) {
        const siteInsert = await pool.query(`
            INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
            VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
            RETURNING site_id;
        `);
        luminaSiteId = siteInsert.rows[0].site_id;
    } else {
        luminaSiteId = siteCheck.rows[0].site_id;
    }

    // 3. Seed the sample GTPL LUMINA/124 DPR report if not already present
    const dprCheck = await pool.query("SELECT dpr_id FROM daily_progress_reports WHERE report_no = 'GTPL LUMINA/124'");
    if (dprCheck.rows.length === 0) {
        await pool.query(`
            INSERT INTO daily_progress_reports (
                report_no, site_id, report_date, client_name, contractor_name,
                po_number, po_value, current_billing_value, billing_progress_pct,
                start_date, completion_date,
                today_activities, next_day_activities, show_stoppers, manpower_data, photos
            ) VALUES (
                'GTPL LUMINA/124',
                $1,
                '2026-10-23',
                'LUMINA',
                'NKD POWER SOLUTIONS PVT LTD',
                '600190',
                48374200.00,
                0.00,
                0.00,
                '2026-04-16',
                '2026-07-24',
                $2,
                $3,
                $4,
                $5,
                $6
            )
        `, [
            luminaSiteId,
            JSON.stringify([
                { id: 1, description: 'Roxtec material unloading and shifting work, [Engaged Manpower: 07]', status: 'complete', dependencies: 'NKD', photo_ref: 'Photo 1' }
            ]),
            JSON.stringify([
                { id: 1, description: '11 kV trench core cutting (cellar room) and 11KV cable pulling in cellar.', dependencies: 'Civil Clearance' }
            ]),
            JSON.stringify([
                { id: 1, concern_area: 'Substation cellar water seepage clearance from Lumina civil team', intimation_date: '2026-10-20' }
            ]),
            JSON.stringify([
                { trade: 'Site Manager', required: 1, available: 1 },
                { trade: 'EHS Officer', required: 1, available: 1 },
                { trade: 'Electrician', required: 2, available: 0 },
                { trade: 'Engineer', required: 1, available: 0 },
                { trade: 'Fitter', required: 1, available: 0 },
                { trade: 'Welder', required: 1, available: 0 },
                { trade: 'Helper', required: 7, available: 7 },
                { trade: 'Supervisor', required: 1, available: 0 },
                { trade: 'Testing Engineer', required: 1, available: 0 },
                { trade: 'Cable Jointer', required: 2, available: 0 },
                { trade: 'Scaffolding Team', required: 4, available: 0 }
            ]),
            JSON.stringify([
                { id: 1, caption: 'Roxtec Material Unloading at Cellar Room', url: '/uploads/sample_dpr_1.jpg' },
                { id: 2, caption: '11kV Trench Alignment & Shifting', url: '/uploads/sample_dpr_2.jpg' }
            ])
        ]);
        console.log('✅ Seeded sample DPR: GTPL LUMINA/124');
    }

    // 4. Ensure DPR module exists in modules table
    await pool.query(`
        INSERT INTO modules (module_name, module_code, description, display_order)
        VALUES ('Daily Progress Reports', 'DPR', 'Multi-project Daily Site Progress Reports & Manpower Tracking', 15)
        ON CONFLICT (module_code) DO NOTHING;
    `);

    // Give Super Admin, HR Admin, Site Manager, Accounts Team, Client Login view rights to DPR
    const dprMod = await pool.query("SELECT module_id FROM modules WHERE module_code = 'DPR'");
    if (dprMod.rows.length > 0) {
        const mId = dprMod.rows[0].module_id;
        const allRoles = await pool.query("SELECT role_id, role_code FROM roles");
        for (const r of allRoles.rows) {
            await pool.query(`
                INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
                VALUES ($1, $2, TRUE, TRUE, TRUE, $3, TRUE, TRUE)
                ON CONFLICT (role_id, module_id) DO UPDATE SET
                    can_view = TRUE, can_create = TRUE, can_update = TRUE, can_export = TRUE
            `, [r.role_id, mId, r.role_code === 'SUPER_ADMIN']);
        }
    }

    console.log('✅ DPR schema initialized & permissions granted.');
    process.exit(0);
}

initDpr().catch(err => {
    console.error('DPR init error:', err);
    process.exit(1);
});
