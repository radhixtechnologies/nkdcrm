const { pool } = require('../config/database');

const cleanInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : n;
};

const cleanNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const cleanDate = (val) => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s === '' ? null : s.slice(0, 10);
};

const getIstToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

const calculateMeasurementQty = (nosVal, lengthVal, breadthVal, depthVal) => {
    const n = cleanNum(nosVal, 1);
    const l = cleanNum(lengthVal, 0);
    const b = cleanNum(breadthVal, 0);
    const d = cleanNum(depthVal, 0);

    let calculatedQty = 0;
    if (l > 0 && b > 0 && d > 0) {
        calculatedQty = n * l * b * d;
    } else if (l > 0 && b > 0) {
        calculatedQty = n * l * b;
    } else if (l > 0) {
        calculatedQty = n * l;
    } else {
        calculatedQty = n;
    }

    return {
        n,
        l,
        b,
        d,
        quantity: parseFloat(calculatedQty.toFixed(3))
    };
};

class SiteOperationsService {
    constructor() {
        this.initPromise = null;
    }

    async ensureTables() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                // 1. Site Concerns & Showstoppers Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS site_concerns (
                        concern_id SERIAL PRIMARY KEY,
                        site_id INT REFERENCES sites(site_id) ON DELETE CASCADE,
                        concern_title VARCHAR(255) NOT NULL,
                        concern_area VARCHAR(150),
                        category VARCHAR(100) DEFAULT 'CLIENT_CLEARANCE',
                        severity VARCHAR(50) DEFAULT 'CRITICAL_SHOWSTOPPER',
                        first_intimation_date DATE NOT NULL,
                        duration_weeks INT DEFAULT 1,
                        responsible_party VARCHAR(100) DEFAULT 'CLIENT',
                        impact_summary TEXT,
                        target_resolution_date DATE,
                        status VARCHAR(50) DEFAULT 'OPEN',
                        resolution_remarks TEXT,
                        resolved_date DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // 2. Site Measurement Sheet (M-Book) Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS site_measurement_sheets (
                        measurement_id SERIAL PRIMARY KEY,
                        site_id INT REFERENCES sites(site_id) ON DELETE CASCADE,
                        item_no VARCHAR(50),
                        description TEXT NOT NULL,
                        location_ref VARCHAR(255),
                        nos NUMERIC(10,2) DEFAULT 1,
                        length NUMERIC(12,3) DEFAULT 0,
                        breadth NUMERIC(12,3) DEFAULT 0,
                        depth NUMERIC(12,3) DEFAULT 0,
                        quantity NUMERIC(14,3) NOT NULL,
                        unit VARCHAR(50) NOT NULL DEFAULT 'MTR',
                        measurement_date DATE NOT NULL,
                        measured_by VARCHAR(150),
                        verified_by VARCHAR(150),
                        remarks TEXT,
                        status VARCHAR(50) DEFAULT 'CERTIFIED',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // 3. Site Tools & Tackles / TPI Calibration Register Table
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS site_tools_tackles (
                        tool_id SERIAL PRIMARY KEY,
                        site_id INT REFERENCES sites(site_id) ON DELETE SET NULL,
                        tool_name VARCHAR(255) NOT NULL,
                        category VARCHAR(100) DEFAULT 'TESTING_EQUIPMENT',
                        quantity INT DEFAULT 1,
                        serial_no VARCHAR(100),
                        make_model VARCHAR(150),
                        tpi_agency VARCHAR(150),
                        certificate_no VARCHAR(100),
                        calibration_date DATE,
                        valid_till DATE NOT NULL,
                        certificate_url TEXT,
                        status VARCHAR(50) DEFAULT 'VALID',
                        remarks TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // 4. Ensure vendors table has scope_of_work and site_id columns
                await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS scope_of_work TEXT;`);
                await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS site_id INT REFERENCES sites(site_id) ON DELETE SET NULL;`);

                // Seed initial data safely
                await this.seedInitialData();
            } catch (err) {
                this.initPromise = null;
                throw err;
            }
        })();

        return this.initPromise;
    }

    async ensureDefaultSiteId() {
        const siteRes = await pool.query("SELECT site_id FROM sites WHERE site_code = 'GTPL-LUMINA' OR site_name ILIKE '%LUMINA%' LIMIT 1");
        if (siteRes.rows.length > 0) return siteRes.rows[0].site_id;

        const inserted = await pool.query(`
            INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
            VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
            ON CONFLICT (site_code) DO UPDATE SET is_active = TRUE
            RETURNING site_id
        `);
        if (inserted.rows[0]?.site_id) return inserted.rows[0].site_id;

        const anySite = await pool.query('SELECT site_id FROM sites ORDER BY site_id ASC LIMIT 1');
        return anySite.rows[0]?.site_id || null;
    }

    async seedInitialData() {
        try {
            const siteId = await this.ensureDefaultSiteId();
            if (!siteId) return;

            const concernsCount = await pool.query('SELECT COUNT(*)::int AS cnt FROM site_concerns');
            if ((concernsCount.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                    INSERT INTO site_concerns (site_id, concern_title, concern_area, category, severity, first_intimation_date, duration_weeks, responsible_party, impact_summary, status)
                    VALUES
                    ($1, '11kV Cable Trench Opening, Dewatering and Sludge Cleaning', 'Cellar Room Trench', 'WATERLOGGING_DEWATERING', 'CRITICAL_SHOWSTOPPER', '2026-05-21', 12, 'NKD', 'Heavy water ingress in trench prevented cable pulling. Dewatering pumps deployed continuously.', 'RESOLVED'),
                    ($1, 'Roxtec Wall Penetration Sleeves Civil Clearance', 'Cellar Wall Transits', 'CIVIL_CLEARANCE', 'CRITICAL_SHOWSTOPPER', '2026-10-15', 2, 'CLIENT', 'Civil wall core cutting and sleeve grouting needed before Roxtec frame installation.', 'IN_PROGRESS'),
                    ($1, '11 kV Trench Core Cutting Permission in Cellar Room', 'Cellar Room Floor', 'CLIENT_APPROVAL', 'MAJOR', '2026-10-20', 1, 'CLIENT', 'Structural engineer approval awaited for core cutting near foundation column.', 'OPEN'),
                    ($1, 'Testing Engineer & Jointer Gate Pass Approval for Substation', 'Main Substation 1', 'GATE_PASS_SECURITY', 'MINOR', '2026-10-22', 1, 'CLIENT', 'Special EHS induction and high-voltage pass required for testing personnel.', 'RESOLVED');
                `, [siteId]);
            }

            const measureCount = await pool.query('SELECT COUNT(*)::int AS cnt FROM site_measurement_sheets');
            if ((measureCount.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                    INSERT INTO site_measurement_sheets (site_id, item_no, description, location_ref, nos, length, breadth, depth, quantity, unit, measurement_date, measured_by, verified_by, remarks, status)
                    VALUES
                    ($1, '1.1', 'Laying & Pulling of 11kV 1Cx1000 Sqmm AL XLPE Cable in Trench', 'Cellar Cable Trench - Bay 1 to Bay 4', 1, 950.000, 0, 0, 950.000, 'MTR', '2026-07-15', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Phase 1 trench cable pulling completed with trefoil clamping', 'CERTIFIED'),
                    ($1, '1.2', 'Laying & Pulling of 11kV 1Cx1000 Sqmm AL XLPE Cable in Cellar', 'Cellar Room to Substation Floor', 1, 850.000, 0, 0, 850.000, 'MTR', '2026-07-28', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Cable pulling through core cut sleeve', 'CERTIFIED'),
                    ($1, '2.1', 'Fabrication, Assembly & Erection of 600mm Hot Dip Galvanized Cable Tray', 'Substation Cellar Trench Route A', 1, 450.000, 0.600, 0, 450.000, 'MTR', '2026-06-25', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Includes GI supports, brackets and fasteners', 'CERTIFIED'),
                    ($1, '2.2', 'Fabrication, Assembly & Erection of 600mm Hot Dip Galvanized Cable Tray', 'Cellar Room Route B', 1, 325.000, 0.600, 0, 325.000, 'MTR', '2026-07-02', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Cable tray elevation 2.4m above floor level', 'CERTIFIED'),
                    ($1, '3.1', 'Laying of 75x12 mm Galvanized Iron (GI) Earthing Strip', 'Main Grounding Grid to Equipment Body', 1, 380.000, 0, 0, 380.000, 'MTR', '2026-06-28', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Overlap welding & bitumen cold compound coating done', 'CERTIFIED'),
                    ($1, '4.1', 'Installation of 75x75x10mm MS Angle and Insert Plates', 'Cellar Wall Support Inserts', 450, 0, 0, 0, 450.000, 'NOS', '2026-05-30', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Anchor fasteners testing verified', 'CERTIFIED'),
                    ($1, '5.1', 'Roxtec Cable Transit Frame and Sealing Module Installation', 'Cellar Wall External Ingress Points', 4, 0, 0, 0, 4.000, 'NOS', '2026-10-23', 'Sudhir Jadaun', 'Lumina Site In-Charge', 'Watertight & firestop seal completed', 'SUBMITTED');
                `, [siteId]);
            }

            const toolsCount = await pool.query('SELECT COUNT(*)::int AS cnt FROM site_tools_tackles');
            if ((toolsCount.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                    INSERT INTO site_tools_tackles (site_id, tool_name, category, quantity, serial_no, make_model, tpi_agency, certificate_no, calibration_date, valid_till, status, remarks)
                    VALUES
                    ($1, '11kV Digital Insulation Resistance Tester (Megger 5kV)', 'TESTING_EQUIPMENT', 1, 'MEG-515-9921', 'Megger MIT515 5kV', 'National Test House (NTH)', 'CAL/NTH/2026/8841', '2026-04-10', '2027-04-09', 'VALID', 'Used for 11kV cable pre-commissioning IR & PI testing. Fully calibrated.'),
                    ($1, 'Electric Submersible Dewatering Pump 5 HP (3-Phase)', 'DEWATERING_PUMP', 3, 'KIRL-KS4-10492', 'Kirloskar KS4 Submersible', 'TUV SUD South Asia', 'TUV/PUMP/2026/102', '2026-05-15', '2027-05-14', 'VALID', 'Essential for continuous 11kV trench water draining in cellar.'),
                    ($1, 'Diesel Engine High-Head Dewatering Pump 7.5 HP', 'DEWATERING_PUMP', 1, 'GREAV-75-309', 'Greaves Cotton 7.5HP Diesel', 'Bureau Veritas (BV)', 'BV/MECH/2026/492', '2026-05-18', '2027-05-17', 'VALID', 'Emergency standby pump during site power outage.'),
                    ($1, 'Electro-Hydraulic Heavy Duty Cable Crimping Tool 16-1000 sq.mm', 'CRIMPING_TOOL', 1, 'KLAUKE-HK-882', 'Klauke HK120/42', 'Aditi Calibration Labs', 'ACL/CRIMP/2026/551', '2026-04-20', '2027-04-19', 'VALID', 'Calibrated for 1000 sq.mm AL cable terminal lugs crimping pressure.'),
                    ($1, 'Digital Torque Wrench 20 - 200 Nm with Certificate', 'TESTING_EQUIPMENT', 2, 'BRIT-TW-4011', 'Britool EHT200', 'TATA Calibration & Testing', 'TCT/TW/2026/119', '2026-06-01', '2026-12-01', 'VALID', 'Used for busbar & 11kV termination bolt torque verification.'),
                    ($1, 'Full Body Safety Harness with Double Lanyard & Shock Absorber', 'LIFTING_SAFETY', 12, 'KARAM-FBH-LOT26', 'Karam PN 56', 'Bureau Veritas (BV)', 'BV/EHS/2026/8991', '2026-04-01', '2026-11-15', 'EXPIRING_SOON', 'Mandatory for height & scaffolding work. TPI inspection due next month.'),
                    ($1, 'Aluminium Mobile Scaffolding Tower (Height 6.5 Meter)', 'SCAFFOLDING', 2, 'ALUM-TWR-02', 'Youngman BoSS Clima', 'TUV Rheinland', 'TUV/SCAF/2026/304', '2026-04-15', '2027-04-14', 'VALID', 'Third-Party Load Tested and safe for cellar tray installation.');
                `, [siteId]);
            }

            const vendorCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM vendors');
            if ((vendorCountRes.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                    INSERT INTO vendors (vendor_code, vendor_name, category, contact_person, phone, email, city, state, scope_of_work, rating, compliance_status)
                    VALUES
                    ('VND-POLYCAB', 'Polycab India Ltd', 'CABLES_CONDUCTORS', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Vadodara', 'Gujarat', 'Primary Manufacturer & Supplier of 11kV 1Cx1000 Sq.mm Aluminum XLPE Power Cables (9,000 meters)', 4.9, 'COMPLIANT'),
                    ('VND-DMP', 'DMP Projects', 'CABLE_TRAYS_EARTHING', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Kolkata', 'West Bengal', 'Supply of 600mm Hot Dip Galvanized Cable Trays (875m) and 75x12mm GI Earthing Strips (500m)', 4.7, 'COMPLIANT'),
                    ('VND-SAIL', 'Steel Authority of India (SAIL)', 'STEEL_HARDWARE', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Turbhe, Navi Mumbai', 'Maharashtra', 'Manufacturer & Stockist of MS Angles (75x75x10mm) and Insert Plates (750 Nos)', 4.8, 'COMPLIANT'),
                    ('VND-3M-RAYCHEM', '3M / Raychem RPG (P) Ltd', 'TERMINATIONS_JOINTS', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Mumbai', 'Maharashtra', 'Manufacturer of 11kV 1Cx1000 Sqmm Heat Shrinkable End Termination Kits (72 Nos)', 5.0, 'COMPLIANT'),
                    ('VND-COMMSCOPE', 'Commscope India', 'FIBER_OPTIC', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'New Delhi', 'Delhi', 'FO Cable Supply (1,000m) & OTDR Optical Fiber Testing', 4.6, 'COMPLIANT'),
                    ('VND-SUPREME', 'Supreme Industries Ltd', 'CONDUITS_PIPES', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Mumbai', 'Maharashtra', 'DWC Conduit & Heavy Duty PVC Conduits (1,000m)', 4.7, 'COMPLIANT'),
                    ('VND-PROREACT', 'ProReact Systems', 'FIRE_SAFETY', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Navi Mumbai', 'Maharashtra', 'Linear Heat Sensing Cable (1,000m) - Client Free-Issue Scope', 4.5, 'COMPLIANT'),
                    ('VND-ROXTEC', 'Roxtec India Pvt Ltd', 'PENETRATION_SEALS', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Gurgaon', 'Haryana', 'Cable Sealing Material, Transit Frames & Sealing Modules (4 Nos)', 4.9, 'COMPLIANT'),
                    ('VND-SGPOWERS', 'SG Powers Pvt Ltd', 'CLAMPS_ACCESSORIES', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Faridabad', 'Haryana', 'Heavy Duty Cast Aluminum Trefoil Clamps for 11kV Single Core Cables (2,000 Nos)', 4.8, 'COMPLIANT')
                    ON CONFLICT (vendor_code) DO NOTHING;
                `);
            }
        } catch (err) {
            console.error('Failed to seed initial site operations data:', err);
        }
    }

    // ==========================================
    // 1. STATS OVERVIEW
    // ==========================================
    async getOperationsStats(siteId = 'ALL') {
        await this.ensureTables();

        let siteFilterSql = '';
        const params = [];
        const parsedSite = siteId && siteId !== 'ALL' ? cleanInt(siteId) : null;
        if (parsedSite) {
            siteFilterSql = ' WHERE site_id = $1';
            params.push(parsedSite);
        }

        const vendorQuery = parsedSite
            ? 'SELECT COUNT(*)::int AS total_vendors FROM vendors WHERE is_active = true AND (site_id = $1 OR site_id IS NULL)'
            : 'SELECT COUNT(*)::int AS total_vendors FROM vendors WHERE is_active = true';

        const [dprRes, concernRes, measureRes, toolsRes, vendorRes] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total_dprs FROM daily_progress_reports ${siteFilterSql}`, params),
            pool.query(`SELECT
                COUNT(*)::int AS total_concerns,
                COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_concerns,
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress_concerns,
                COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_concerns,
                COUNT(*) FILTER (WHERE severity = 'CRITICAL_SHOWSTOPPER')::int AS showstoppers
                FROM site_concerns ${siteFilterSql}`, params),
            pool.query(`SELECT
                COUNT(*)::int AS total_entries,
                COALESCE(SUM(quantity), 0) AS total_measured_qty,
                COUNT(*) FILTER (WHERE status = 'CERTIFIED')::int AS certified_entries,
                COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted_entries
                FROM site_measurement_sheets ${siteFilterSql}`, params),
            pool.query(`SELECT
                COUNT(*)::int AS total_tools,
                COALESCE(SUM(quantity), 0)::int AS total_quantity,
                COUNT(*) FILTER (WHERE valid_till > ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'))::int AS valid_tools,
                COUNT(*) FILTER (WHERE valid_till >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND valid_till <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days'))::int AS expiring_tools,
                COUNT(*) FILTER (WHERE valid_till < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)::int AS expired_tools
                FROM site_tools_tackles ${siteFilterSql}`, params),
            pool.query(vendorQuery, params)
        ]);

        return {
            dprs: dprRes.rows[0],
            concerns: concernRes.rows[0],
            measurements: measureRes.rows[0],
            tools: toolsRes.rows[0],
            vendors: vendorRes.rows[0]
        };
    }

    // ==========================================
    // 2. CONCERNS / ISSUE REPORTING
    // ==========================================
    async getConcerns({ site_id, status, severity, search } = {}) {
        await this.ensureTables();
        let query = `
            SELECT c.concern_id, c.site_id, c.concern_title, c.concern_area, c.category, c.severity,
                   TO_CHAR(c.first_intimation_date, 'YYYY-MM-DD') AS first_intimation_date,
                   c.duration_weeks, c.responsible_party, c.impact_summary,
                   TO_CHAR(c.target_resolution_date, 'YYYY-MM-DD') AS target_resolution_date,
                   c.status, c.resolution_remarks,
                   TO_CHAR(c.resolved_date, 'YYYY-MM-DD') AS resolved_date,
                   c.created_at,
                   s.site_name, s.site_code, s.city AS site_city,
                   GREATEST(0, ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - c.first_intimation_date))::int AS days_open
            FROM site_concerns c
            LEFT JOIN sites s ON c.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND c.site_id = $${pIndex++}`;
            params.push(cleanInt(site_id));
        }
        if (status && status !== 'ALL') {
            query += ` AND c.status = $${pIndex++}`;
            params.push(status);
        }
        if (severity && severity !== 'ALL') {
            query += ` AND c.severity = $${pIndex++}`;
            params.push(severity);
        }
        if (search && String(search).trim() !== '') {
            query += ` AND (c.concern_title ILIKE $${pIndex} OR COALESCE(c.concern_area, '') ILIKE $${pIndex} OR COALESCE(c.responsible_party, '') ILIKE $${pIndex})`;
            params.push(`%${String(search).trim()}%`);
            pIndex++;
        }

        query += ` ORDER BY CASE WHEN c.status = 'OPEN' THEN 1 WHEN c.status = 'IN_PROGRESS' THEN 2 ELSE 3 END, c.first_intimation_date ASC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    async createConcern(data) {
        await this.ensureTables();
        const {
            site_id, concern_title, concern_area, category, severity,
            first_intimation_date, duration_weeks, responsible_party,
            impact_summary, target_resolution_date, status, resolution_remarks
        } = data;

        const siteId = cleanInt(site_id);
        if (!siteId || !concern_title || String(concern_title).trim() === '') {
            const err = new Error('Site and Concern Title are required');
            err.status = 400;
            throw err;
        }

        const res = await pool.query(`
            INSERT INTO site_concerns (
                site_id, concern_title, concern_area, category, severity,
                first_intimation_date, duration_weeks, responsible_party,
                impact_summary, target_resolution_date, status, resolution_remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *,
              TO_CHAR(first_intimation_date, 'YYYY-MM-DD') AS first_intimation_date,
              TO_CHAR(target_resolution_date, 'YYYY-MM-DD') AS target_resolution_date,
              TO_CHAR(resolved_date, 'YYYY-MM-DD') AS resolved_date
        `, [
            siteId,
            String(concern_title).trim(),
            concern_area || '',
            category || 'CLIENT_CLEARANCE',
            severity || 'CRITICAL_SHOWSTOPPER',
            cleanDate(first_intimation_date) || getIstToday(),
            cleanInt(duration_weeks, 1),
            responsible_party || 'CLIENT',
            impact_summary || '',
            cleanDate(target_resolution_date),
            status || 'OPEN',
            resolution_remarks || ''
        ]);
        return res.rows[0];
    }

    async updateConcern(concernId, data) {
        await this.ensureTables();
        const id = cleanInt(concernId);
        const existingRes = await pool.query('SELECT * FROM site_concerns WHERE concern_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Site concern not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];
        const nextStatus = data.status !== undefined ? data.status : ex.status;
        const resolvedDate = nextStatus === 'RESOLVED'
            ? (cleanDate(data.resolved_date) || ex.resolved_date || getIstToday())
            : null;

        const res = await pool.query(`
            UPDATE site_concerns SET
                site_id = $1,
                concern_title = $2,
                concern_area = $3,
                category = $4,
                severity = $5,
                first_intimation_date = $6,
                duration_weeks = $7,
                responsible_party = $8,
                impact_summary = $9,
                target_resolution_date = $10,
                status = $11,
                resolution_remarks = $12,
                resolved_date = $13
            WHERE concern_id = $14
            RETURNING *,
              TO_CHAR(first_intimation_date, 'YYYY-MM-DD') AS first_intimation_date,
              TO_CHAR(target_resolution_date, 'YYYY-MM-DD') AS target_resolution_date,
              TO_CHAR(resolved_date, 'YYYY-MM-DD') AS resolved_date
        `, [
            data.site_id !== undefined ? cleanInt(data.site_id, ex.site_id) : ex.site_id,
            data.concern_title !== undefined ? data.concern_title : ex.concern_title,
            data.concern_area !== undefined ? (data.concern_area || '') : ex.concern_area,
            data.category !== undefined ? data.category : ex.category,
            data.severity !== undefined ? data.severity : ex.severity,
            data.first_intimation_date !== undefined ? (cleanDate(data.first_intimation_date) || ex.first_intimation_date) : ex.first_intimation_date,
            data.duration_weeks !== undefined ? cleanInt(data.duration_weeks, ex.duration_weeks) : ex.duration_weeks,
            data.responsible_party !== undefined ? data.responsible_party : ex.responsible_party,
            data.impact_summary !== undefined ? (data.impact_summary || '') : ex.impact_summary,
            data.target_resolution_date !== undefined ? cleanDate(data.target_resolution_date) : ex.target_resolution_date,
            nextStatus,
            data.resolution_remarks !== undefined ? (data.resolution_remarks || '') : ex.resolution_remarks,
            resolvedDate,
            id
        ]);
        return res.rows[0];
    }

    async deleteConcern(concernId) {
        await this.ensureTables();
        const res = await pool.query('DELETE FROM site_concerns WHERE concern_id = $1 RETURNING concern_id', [cleanInt(concernId)]);
        if (res.rows.length === 0) {
            const err = new Error('Site concern not found');
            err.status = 404;
            throw err;
        }
        return { success: true };
    }

    // ==========================================
    // 3. MEASUREMENT SHEETS (M-BOOK)
    // ==========================================
    async getMeasurements({ site_id, search, start_date, end_date, status } = {}) {
        await this.ensureTables();
        let query = `
            SELECT m.measurement_id, m.site_id, m.item_no, m.description, m.location_ref,
                   m.nos, m.length, m.breadth, m.depth, m.quantity, m.unit,
                   TO_CHAR(m.measurement_date, 'YYYY-MM-DD') AS measurement_date,
                   TO_CHAR(m.measurement_date, 'YYYY-MM-DD') AS measurement_date_fmt,
                   TO_CHAR(m.measurement_date, 'DD-Mon-YYYY') AS measurement_date_display,
                   m.measured_by, m.verified_by, m.remarks, m.status, m.created_at,
                   s.site_name, s.site_code, s.principal_employer_name AS client_name
            FROM site_measurement_sheets m
            LEFT JOIN sites s ON m.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND m.site_id = $${pIndex++}`;
            params.push(cleanInt(site_id));
        }
        if (status && status !== 'ALL') {
            query += ` AND m.status = $${pIndex++}`;
            params.push(status);
        }
        if (start_date) {
            query += ` AND m.measurement_date >= $${pIndex++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND m.measurement_date <= $${pIndex++}`;
            params.push(end_date);
        }
        if (search && String(search).trim() !== '') {
            query += ` AND (m.description ILIKE $${pIndex} OR COALESCE(m.item_no, '') ILIKE $${pIndex} OR COALESCE(m.location_ref, '') ILIKE $${pIndex})`;
            params.push(`%${String(search).trim()}%`);
            pIndex++;
        }

        query += ` ORDER BY m.measurement_date DESC, m.measurement_id DESC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    async createMeasurement(data) {
        await this.ensureTables();
        const siteId = cleanInt(data.site_id);
        if (!siteId || !data.description || String(data.description).trim() === '') {
            const err = new Error('Site and Description are required for measurement entry');
            err.status = 400;
            throw err;
        }

        const calc = calculateMeasurementQty(data.nos, data.length, data.breadth, data.depth);

        const res = await pool.query(`
            INSERT INTO site_measurement_sheets (
                site_id, item_no, description, location_ref,
                nos, length, breadth, depth, quantity, unit,
                measurement_date, measured_by, verified_by, remarks, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *,
              TO_CHAR(measurement_date, 'YYYY-MM-DD') AS measurement_date,
              TO_CHAR(measurement_date, 'YYYY-MM-DD') AS measurement_date_fmt,
              TO_CHAR(measurement_date, 'DD-Mon-YYYY') AS measurement_date_display
        `, [
            siteId,
            data.item_no || '',
            String(data.description).trim(),
            data.location_ref || '',
            calc.n,
            calc.l,
            calc.b,
            calc.d,
            calc.quantity,
            (data.unit || 'MTR').toUpperCase(),
            cleanDate(data.measurement_date) || getIstToday(),
            data.measured_by || 'Site Engineer',
            data.verified_by || 'Client In-Charge',
            data.remarks || '',
            data.status || 'SUBMITTED'
        ]);
        return res.rows[0];
    }

    async updateMeasurement(id, data) {
        await this.ensureTables();
        const measId = cleanInt(id);
        const existingRes = await pool.query('SELECT * FROM site_measurement_sheets WHERE measurement_id = $1', [measId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Measurement entry not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const calc = calculateMeasurementQty(
            data.nos !== undefined ? data.nos : ex.nos,
            data.length !== undefined ? data.length : ex.length,
            data.breadth !== undefined ? data.breadth : ex.breadth,
            data.depth !== undefined ? data.depth : ex.depth
        );

        const res = await pool.query(`
            UPDATE site_measurement_sheets SET
                site_id = $1,
                item_no = $2,
                description = $3,
                location_ref = $4,
                nos = $5,
                length = $6,
                breadth = $7,
                depth = $8,
                quantity = $9,
                unit = $10,
                measurement_date = $11,
                measured_by = $12,
                verified_by = $13,
                remarks = $14,
                status = $15
            WHERE measurement_id = $16
            RETURNING *,
              TO_CHAR(measurement_date, 'YYYY-MM-DD') AS measurement_date,
              TO_CHAR(measurement_date, 'YYYY-MM-DD') AS measurement_date_fmt,
              TO_CHAR(measurement_date, 'DD-Mon-YYYY') AS measurement_date_display
        `, [
            data.site_id !== undefined ? cleanInt(data.site_id, ex.site_id) : ex.site_id,
            data.item_no !== undefined ? (data.item_no || '') : ex.item_no,
            data.description !== undefined ? data.description : ex.description,
            data.location_ref !== undefined ? (data.location_ref || '') : ex.location_ref,
            calc.n,
            calc.l,
            calc.b,
            calc.d,
            calc.quantity,
            data.unit ? String(data.unit).toUpperCase() : ex.unit,
            data.measurement_date !== undefined ? (cleanDate(data.measurement_date) || ex.measurement_date) : ex.measurement_date,
            data.measured_by !== undefined ? data.measured_by : ex.measured_by,
            data.verified_by !== undefined ? data.verified_by : ex.verified_by,
            data.remarks !== undefined ? (data.remarks || '') : ex.remarks,
            data.status !== undefined ? data.status : ex.status,
            measId
        ]);
        return res.rows[0];
    }

    async deleteMeasurement(id) {
        await this.ensureTables();
        const res = await pool.query('DELETE FROM site_measurement_sheets WHERE measurement_id = $1 RETURNING measurement_id', [cleanInt(id)]);
        if (res.rows.length === 0) {
            const err = new Error('Measurement entry not found');
            err.status = 404;
            throw err;
        }
        return { success: true };
    }

    // ==========================================
    // 4. VENDOR MAPPING & SCOPE DIRECTORY
    // ==========================================
    async getVendorsWithScope({ site_id, category, search } = {}) {
        await this.ensureTables();
        let query = `
            SELECT v.*, s.site_name, s.site_code
            FROM vendors v
            LEFT JOIN sites s ON v.site_id = s.site_id
            WHERE v.is_active = true
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND (v.site_id = $${pIndex} OR v.site_id IS NULL)`;
            params.push(cleanInt(site_id));
            pIndex++;
        }
        if (category && category !== 'ALL') {
            query += ` AND v.category = $${pIndex++}`;
            params.push(category);
        }
        if (search && String(search).trim() !== '') {
            query += ` AND (v.vendor_name ILIKE $${pIndex} OR COALESCE(v.contact_person, '') ILIKE $${pIndex} OR COALESCE(v.scope_of_work, '') ILIKE $${pIndex} OR COALESCE(v.city, '') ILIKE $${pIndex})`;
            params.push(`%${String(search).trim()}%`);
            pIndex++;
        }

        query += ` ORDER BY v.vendor_name ASC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    async updateVendorScope(vendorId, data = {}) {
        await this.ensureTables();
        const id = cleanInt(vendorId);
        const existingRes = await pool.query('SELECT * FROM vendors WHERE vendor_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Vendor not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const res = await pool.query(`
            UPDATE vendors SET
                scope_of_work = $1,
                site_id = $2,
                contact_person = $3,
                phone = $4,
                email = $5,
                city = $6,
                state = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE vendor_id = $8
            RETURNING *
        `, [
            data.scope_of_work !== undefined ? (data.scope_of_work || null) : ex.scope_of_work,
            data.site_id !== undefined ? cleanInt(data.site_id, null) : ex.site_id,
            data.contact_person !== undefined ? (data.contact_person || null) : ex.contact_person,
            data.phone !== undefined ? (data.phone || null) : ex.phone,
            data.email !== undefined ? (data.email || null) : ex.email,
            data.city !== undefined ? (data.city || null) : ex.city,
            data.state !== undefined ? (data.state || null) : ex.state,
            id
        ]);
        return res.rows[0];
    }

    // ==========================================
    // 5. INVENTORY & TOOLS & TACKLES (TPI / CALIBRATION)
    // ==========================================
    async getToolsAndTackles({ site_id, status, category, search } = {}) {
        await this.ensureTables();
        let query = `
            SELECT t.tool_id, t.site_id, t.tool_name, t.category, t.quantity, t.serial_no,
                   t.make_model, t.tpi_agency, t.certificate_no, t.certificate_url, t.status, t.remarks, t.created_at,
                   s.site_name, s.site_code,
                   TO_CHAR(t.calibration_date, 'YYYY-MM-DD') AS calibration_date,
                   TO_CHAR(t.calibration_date, 'YYYY-MM-DD') AS calibration_date_fmt,
                   TO_CHAR(t.calibration_date, 'DD-Mon-YYYY') AS calibration_date_display,
                   TO_CHAR(t.valid_till, 'YYYY-MM-DD') AS valid_till,
                   TO_CHAR(t.valid_till, 'YYYY-MM-DD') AS valid_till_fmt,
                   TO_CHAR(t.valid_till, 'DD-Mon-YYYY') AS valid_till_display,
                   (t.valid_till - (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)::int AS days_remaining,
                   CASE
                       WHEN t.valid_till < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 'EXPIRED'
                       WHEN t.valid_till <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days') THEN 'EXPIRING_SOON'
                       ELSE 'VALID'
                   END AS computed_status
            FROM site_tools_tackles t
            LEFT JOIN sites s ON t.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND t.site_id = $${pIndex++}`;
            params.push(cleanInt(site_id));
        }
        if (category && category !== 'ALL') {
            query += ` AND t.category = $${pIndex++}`;
            params.push(category);
        }
        if (search && String(search).trim() !== '') {
            query += ` AND (t.tool_name ILIKE $${pIndex} OR COALESCE(t.tpi_agency, '') ILIKE $${pIndex} OR COALESCE(t.certificate_no, '') ILIKE $${pIndex} OR COALESCE(t.make_model, '') ILIKE $${pIndex})`;
            params.push(`%${String(search).trim()}%`);
            pIndex++;
        }

        query += ` ORDER BY CASE WHEN t.valid_till < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 WHEN t.valid_till <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '30 days') THEN 2 ELSE 3 END, t.valid_till ASC`;
        const res = await pool.query(query, params);

        let rows = res.rows;
        if (status && status !== 'ALL') {
            rows = rows.filter(r => r.computed_status === status);
        }
        return rows;
    }

    async createTool(data) {
        await this.ensureTables();
        const {
            site_id, tool_name, category, quantity, serial_no,
            make_model, tpi_agency, certificate_no, calibration_date,
            valid_till, certificate_url, remarks
        } = data;

        const cleanValidTill = cleanDate(valid_till);
        if (!tool_name || String(tool_name).trim() === '' || !cleanValidTill) {
            const err = new Error('Tool Name and TPI/Calibration Valid Till date are required');
            err.status = 400;
            throw err;
        }

        const res = await pool.query(`
            INSERT INTO site_tools_tackles (
                site_id, tool_name, category, quantity, serial_no,
                make_model, tpi_agency, certificate_no, calibration_date,
                valid_till, certificate_url, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *,
              TO_CHAR(calibration_date, 'YYYY-MM-DD') AS calibration_date,
              TO_CHAR(valid_till, 'YYYY-MM-DD') AS valid_till
        `, [
            cleanInt(site_id),
            String(tool_name).trim(),
            category || 'TESTING_EQUIPMENT',
            cleanInt(quantity, 1),
            serial_no || '',
            make_model || '',
            tpi_agency || '',
            certificate_no || '',
            cleanDate(calibration_date),
            cleanValidTill,
            certificate_url || null,
            remarks || ''
        ]);
        return res.rows[0];
    }

    async updateTool(id, data) {
        await this.ensureTables();
        const toolId = cleanInt(id);
        const existingRes = await pool.query('SELECT * FROM site_tools_tackles WHERE tool_id = $1', [toolId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Tool record not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const res = await pool.query(`
            UPDATE site_tools_tackles SET
                site_id = $1,
                tool_name = $2,
                category = $3,
                quantity = $4,
                serial_no = $5,
                make_model = $6,
                tpi_agency = $7,
                certificate_no = $8,
                calibration_date = $9,
                valid_till = $10,
                certificate_url = $11,
                remarks = $12,
                status = $13
            WHERE tool_id = $14
            RETURNING *,
              TO_CHAR(calibration_date, 'YYYY-MM-DD') AS calibration_date,
              TO_CHAR(valid_till, 'YYYY-MM-DD') AS valid_till
        `, [
            data.site_id !== undefined ? cleanInt(data.site_id, null) : ex.site_id,
            data.tool_name !== undefined ? data.tool_name : ex.tool_name,
            data.category !== undefined ? data.category : ex.category,
            data.quantity !== undefined ? cleanInt(data.quantity, ex.quantity) : ex.quantity,
            data.serial_no !== undefined ? (data.serial_no || '') : ex.serial_no,
            data.make_model !== undefined ? (data.make_model || '') : ex.make_model,
            data.tpi_agency !== undefined ? (data.tpi_agency || '') : ex.tpi_agency,
            data.certificate_no !== undefined ? (data.certificate_no || '') : ex.certificate_no,
            data.calibration_date !== undefined ? cleanDate(data.calibration_date) : ex.calibration_date,
            data.valid_till !== undefined ? (cleanDate(data.valid_till) || ex.valid_till) : ex.valid_till,
            data.certificate_url !== undefined ? (data.certificate_url || null) : ex.certificate_url,
            data.remarks !== undefined ? (data.remarks || '') : ex.remarks,
            data.status !== undefined ? data.status : ex.status,
            toolId
        ]);
        return res.rows[0];
    }

    async deleteTool(id) {
        await this.ensureTables();
        const res = await pool.query('DELETE FROM site_tools_tackles WHERE tool_id = $1 RETURNING tool_id', [cleanInt(id)]);
        if (res.rows.length === 0) {
            const err = new Error('Tool record not found');
            err.status = 404;
            throw err;
        }
        return { success: true };
    }
}

module.exports = new SiteOperationsService();
