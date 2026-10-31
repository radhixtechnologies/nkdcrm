const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

class SiteOperationsService {
    constructor() {
        this.initialized = false;
    }

    async ensureTables() {
        if (this.initialized) return;

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
        try {
            await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS scope_of_work TEXT;`);
            await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS site_id INT REFERENCES sites(site_id) ON DELETE SET NULL;`);
        } catch (_) {}

        // Seed initial data for GTPL LUMINA
        await this.seedInitialData();
        this.initialized = true;
    }

    async seedInitialData() {
        try {
            // Find GTPL Lumina site_id
            const siteRes = await pool.query("SELECT site_id FROM sites WHERE site_code = 'GTPL-LUMINA' OR site_name ILIKE '%LUMINA%' LIMIT 1");
            const siteId = siteRes.rows[0]?.site_id || 5;

            // Seed Concerns if empty
            const concernsCount = await pool.query("SELECT COUNT(*) FROM site_concerns");
            if (parseInt(concernsCount.rows[0].count) === 0) {
                await pool.query(`
                    INSERT INTO site_concerns (site_id, concern_title, concern_area, category, severity, first_intimation_date, duration_weeks, responsible_party, impact_summary, status)
                    VALUES 
                    ($1, '11kV Cable Trench Opening, Dewatering and Sludge Cleaning', 'Cellar Room Trench', 'WATERLOGGING_DEWATERING', 'CRITICAL_SHOWSTOPPER', '2026-05-21', 12, 'NKD', 'Heavy water ingress in trench prevented cable pulling. Dewatering pumps deployed continuously.', 'RESOLVED'),
                    ($1, 'Roxtec Wall Penetration Sleeves Civil Clearance', 'Cellar Wall Transits', 'CIVIL_CLEARANCE', 'CRITICAL_SHOWSTOPPER', '2026-10-15', 2, 'CLIENT', 'Civil wall core cutting and sleeve grouting needed before Roxtec frame installation.', 'IN_PROGRESS'),
                    ($1, '11 kV Trench Core Cutting Permission in Cellar Room', 'Cellar Room Floor', 'CLIENT_APPROVAL', 'MAJOR', '2026-10-20', 1, 'CLIENT', 'Structural engineer approval awaited for core cutting near foundation column.', 'OPEN'),
                    ($1, 'Testing Engineer & Jointer Gate Pass Approval for Substation', 'Main Substation 1', 'GATE_PASS_SECURITY', 'MINOR', '2026-10-22', 1, 'CLIENT', 'Special EHS induction and high-voltage pass required for testing personnel.', 'RESOLVED');
                `, [siteId]);
            }

            // Seed Measurement Sheets if empty
            const measureCount = await pool.query("SELECT COUNT(*) FROM site_measurement_sheets");
            if (parseInt(measureCount.rows[0].count) === 0) {
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

            // Seed Tools & Tackles / TPI Calibration if empty
            const toolsCount = await pool.query("SELECT COUNT(*) FROM site_tools_tackles");
            if (parseInt(toolsCount.rows[0].count) === 0) {
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

            // Ensure vendors exist from procurement materials
            const vendorCountRes = await pool.query("SELECT COUNT(*) FROM vendors");
            if (parseInt(vendorCountRes.rows[0].count) === 0) {
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
                    ('VND-SGPOWERS', 'SG Powers Pvt Ltd', 'CLAMPS_ACCESSORIES', 'Sudhir Jadaun', '9358555155', 'Sudhir.jadaun@nkdpowersolutions.com', 'Faridabad', 'Haryana', 'Heavy Duty Cast Aluminum Trefoil Clamps for 11kV Single Core Cables (2,000 Nos)', 4.8, 'COMPLIANT');
                `);
            } else {
                // Seed GTPL vendor mapping scope of work in vendors table if missing
                await pool.query(`
                    UPDATE vendors SET scope_of_work = 'Primary Manufacturer & Supplier of 11kV 1Cx1000 Sq.mm Aluminum XLPE Power Cables (9,000 meters)' WHERE vendor_name ILIKE '%Polycab%';
                    UPDATE vendors SET scope_of_work = 'Supply of 600mm Hot Dip Galvanized Cable Trays (875m) and 75x12mm GI Earthing Strips (500m)' WHERE vendor_name ILIKE '%DMP%';
                    UPDATE vendors SET scope_of_work = 'Manufacturer & Stockist of MS Angles (75x75x10mm) and Insert Plates (750 Nos)' WHERE vendor_name ILIKE '%SAIL%';
                    UPDATE vendors SET scope_of_work = 'Manufacturer of 11kV 1Cx1000 Sqmm Heat Shrinkable End Termination Kits (72 Nos)' WHERE vendor_name ILIKE '%3M%' OR vendor_name ILIKE '%Raychem%';
                    UPDATE vendors SET scope_of_work = 'Supply of Cable Sealing Material, Transit Frames & Sealing Modules (4 Nos)' WHERE vendor_name ILIKE '%Roxtec%' OR vendor_name ILIKE '%Roxtech%';
                    UPDATE vendors SET scope_of_work = 'Manufacturer of Heavy Duty Cast Aluminum Trefoil Clamps for 11kV Cables (2,000 Nos)' WHERE vendor_name ILIKE '%SG Power%';
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
        if (siteId && siteId !== 'ALL') {
            siteFilterSql = ' WHERE site_id = $1';
            params.push(parseInt(siteId));
        }

        const [dprRes, concernRes, measureRes, toolsRes, vendorRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total_dprs FROM daily_progress_reports ${siteFilterSql}`, params),
            pool.query(`SELECT 
                COUNT(*) as total_concerns,
                COUNT(*) FILTER (WHERE status = 'OPEN') as open_concerns,
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_concerns,
                COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_concerns,
                COUNT(*) FILTER (WHERE severity = 'CRITICAL_SHOWSTOPPER') as showstoppers
                FROM site_concerns ${siteFilterSql}`, params),
            pool.query(`SELECT 
                COUNT(*) as total_entries,
                COALESCE(SUM(quantity), 0) as total_measured_qty,
                COUNT(*) FILTER (WHERE status = 'CERTIFIED') as certified_entries,
                COUNT(*) FILTER (WHERE status = 'SUBMITTED') as submitted_entries
                FROM site_measurement_sheets ${siteFilterSql}`, params),
            pool.query(`SELECT 
                COUNT(*) as total_tools,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COUNT(*) FILTER (WHERE valid_till >= CURRENT_DATE AND valid_till > CURRENT_DATE + INTERVAL '30 days') as valid_tools,
                COUNT(*) FILTER (WHERE valid_till >= CURRENT_DATE AND valid_till <= CURRENT_DATE + INTERVAL '30 days') as expiring_tools,
                COUNT(*) FILTER (WHERE valid_till < CURRENT_DATE) as expired_tools
                FROM site_tools_tackles ${siteFilterSql}`, params),
            pool.query(`SELECT COUNT(*) as total_vendors FROM vendors WHERE is_active = true`)
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
    async getConcerns({ site_id, status, severity, search }) {
        await this.ensureTables();
        let query = `
            SELECT c.*, s.site_name, s.site_code, s.city as site_city,
                   CURRENT_DATE - c.first_intimation_date as days_open
            FROM site_concerns c
            LEFT JOIN sites s ON c.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND c.site_id = $${pIndex++}`;
            params.push(parseInt(site_id));
        }
        if (status && status !== 'ALL') {
            query += ` AND c.status = $${pIndex++}`;
            params.push(status);
        }
        if (severity && severity !== 'ALL') {
            query += ` AND c.severity = $${pIndex++}`;
            params.push(severity);
        }
        if (search) {
            query += ` AND (c.concern_title ILIKE $${pIndex} OR c.concern_area ILIKE $${pIndex} OR c.responsible_party ILIKE $${pIndex})`;
            params.push(`%${search}%`);
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

        const res = await pool.query(`
            INSERT INTO site_concerns (
                site_id, concern_title, concern_area, category, severity,
                first_intimation_date, duration_weeks, responsible_party,
                impact_summary, target_resolution_date, status, resolution_remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            parseInt(site_id),
            concern_title,
            concern_area || '',
            category || 'CLIENT_CLEARANCE',
            severity || 'CRITICAL_SHOWSTOPPER',
            first_intimation_date || new Date().toISOString().split('T')[0],
            duration_weeks ? parseInt(duration_weeks) : 1,
            responsible_party || 'CLIENT',
            impact_summary || '',
            target_resolution_date || null,
            status || 'OPEN',
            resolution_remarks || ''
        ]);
        return res.rows[0];
    }

    async updateConcern(concernId, data) {
        await this.ensureTables();
        const {
            concern_title, concern_area, category, severity,
            first_intimation_date, duration_weeks, responsible_party,
            impact_summary, target_resolution_date, status, resolution_remarks, resolved_date
        } = data;

        const res = await pool.query(`
            UPDATE site_concerns SET
                concern_title = COALESCE($1, concern_title),
                concern_area = COALESCE($2, concern_area),
                category = COALESCE($3, category),
                severity = COALESCE($4, severity),
                first_intimation_date = COALESCE($5, first_intimation_date),
                duration_weeks = COALESCE($6, duration_weeks),
                responsible_party = COALESCE($7, responsible_party),
                impact_summary = COALESCE($8, impact_summary),
                target_resolution_date = $9,
                status = COALESCE($10, status),
                resolution_remarks = COALESCE($11, resolution_remarks),
                resolved_date = $12
            WHERE concern_id = $13
            RETURNING *
        `, [
            concern_title, concern_area, category, severity,
            first_intimation_date, duration_weeks ? parseInt(duration_weeks) : null, responsible_party,
            impact_summary, target_resolution_date || null, status, resolution_remarks,
            status === 'RESOLVED' ? (resolved_date || new Date().toISOString().split('T')[0]) : null,
            parseInt(concernId)
        ]);
        return res.rows[0];
    }

    async deleteConcern(concernId) {
        await this.ensureTables();
        await pool.query('DELETE FROM site_concerns WHERE concern_id = $1', [parseInt(concernId)]);
        return { success: true };
    }

    // ==========================================
    // 3. MEASUREMENT SHEETS (M-BOOK)
    // ==========================================
    async getMeasurements({ site_id, search, start_date, end_date, status }) {
        await this.ensureTables();
        let query = `
            SELECT m.*, s.site_name, s.site_code, s.principal_employer_name as client_name,
                   TO_CHAR(m.measurement_date, 'YYYY-MM-DD') as measurement_date_fmt,
                   TO_CHAR(m.measurement_date, 'DD-Mon-YYYY') as measurement_date_display
            FROM site_measurement_sheets m
            LEFT JOIN sites s ON m.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND m.site_id = $${pIndex++}`;
            params.push(parseInt(site_id));
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
        if (search) {
            query += ` AND (m.description ILIKE $${pIndex} OR m.item_no ILIKE $${pIndex} OR m.location_ref ILIKE $${pIndex})`;
            params.push(`%${search}%`);
            pIndex++;
        }

        query += ` ORDER BY m.measurement_date DESC, m.measurement_id DESC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    async createMeasurement(data) {
        await this.ensureTables();
        const {
            site_id, item_no, description, location_ref,
            nos, length, breadth, depth, unit,
            measurement_date, measured_by, verified_by, remarks, status
        } = data;

        const n = parseFloat(nos) || 1;
        const l = parseFloat(length) || 0;
        const b = parseFloat(breadth) || 0;
        const d = parseFloat(depth) || 0;

        // Auto calculate standard M-book volume/area/length quantity
        let calculatedQty = 0;
        if (l > 0 && b > 0 && d > 0) {
            calculatedQty = n * l * b * d; // Cubic volume (Cum)
        } else if (l > 0 && b > 0) {
            calculatedQty = n * l * b; // Square area (Sqm)
        } else if (l > 0) {
            calculatedQty = n * l; // Running length (Mtr)
        } else {
            calculatedQty = n; // Count (Nos / Set)
        }

        const res = await pool.query(`
            INSERT INTO site_measurement_sheets (
                site_id, item_no, description, location_ref,
                nos, length, breadth, depth, quantity, unit,
                measurement_date, measured_by, verified_by, remarks, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            parseInt(site_id),
            item_no || '',
            description,
            location_ref || '',
            n, l, b, d,
            parseFloat(calculatedQty.toFixed(3)),
            (unit || 'MTR').toUpperCase(),
            measurement_date || new Date().toISOString().split('T')[0],
            measured_by || 'Site Engineer',
            verified_by || 'Client In-Charge',
            remarks || '',
            status || 'SUBMITTED'
        ]);
        return res.rows[0];
    }

    async updateMeasurement(id, data) {
        await this.ensureTables();
        const {
            item_no, description, location_ref,
            nos, length, breadth, depth, unit,
            measurement_date, measured_by, verified_by, remarks, status
        } = data;

        const n = parseFloat(nos) || 1;
        const l = parseFloat(length) || 0;
        const b = parseFloat(breadth) || 0;
        const d = parseFloat(depth) || 0;

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

        const res = await pool.query(`
            UPDATE site_measurement_sheets SET
                item_no = COALESCE($1, item_no),
                description = COALESCE($2, description),
                location_ref = COALESCE($3, location_ref),
                nos = $4,
                length = $5,
                breadth = $6,
                depth = $7,
                quantity = $8,
                unit = COALESCE($9, unit),
                measurement_date = COALESCE($10, measurement_date),
                measured_by = COALESCE($11, measured_by),
                verified_by = COALESCE($12, verified_by),
                remarks = COALESCE($13, remarks),
                status = COALESCE($14, status)
            WHERE measurement_id = $15
            RETURNING *
        `, [
            item_no, description, location_ref,
            n, l, b, d, parseFloat(calculatedQty.toFixed(3)),
            unit ? unit.toUpperCase() : null,
            measurement_date, measured_by, verified_by, remarks, status,
            parseInt(id)
        ]);
        return res.rows[0];
    }

    async deleteMeasurement(id) {
        await this.ensureTables();
        await pool.query('DELETE FROM site_measurement_sheets WHERE measurement_id = $1', [parseInt(id)]);
        return { success: true };
    }

    // ==========================================
    // 4. VENDOR MAPPING & SCOPE DIRECTORY
    // ==========================================
    async getVendorsWithScope({ site_id, category, search }) {
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
            params.push(parseInt(site_id));
            pIndex++;
        }
        if (category && category !== 'ALL') {
            query += ` AND v.category = $${pIndex++}`;
            params.push(category);
        }
        if (search) {
            query += ` AND (v.vendor_name ILIKE $${pIndex} OR v.contact_person ILIKE $${pIndex} OR v.scope_of_work ILIKE $${pIndex} OR v.city ILIKE $${pIndex})`;
            params.push(`%${search}%`);
            pIndex++;
        }

        query += ` ORDER BY v.vendor_name ASC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    async updateVendorScope(vendorId, { scope_of_work, site_id, contact_person, phone, email, city, state }) {
        await this.ensureTables();
        const res = await pool.query(`
            UPDATE vendors SET
                scope_of_work = COALESCE($1, scope_of_work),
                site_id = COALESCE($2, site_id),
                contact_person = COALESCE($3, contact_person),
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                city = COALESCE($6, city),
                state = COALESCE($7, state)
            WHERE vendor_id = $8
            RETURNING *
        `, [scope_of_work, site_id ? parseInt(site_id) : null, contact_person, phone, email, city, state, parseInt(vendorId)]);
        return res.rows[0];
    }

    // ==========================================
    // 5. INVENTORY & TOOLS & TACKLES (TPI / CALIBRATION)
    // ==========================================
    async getToolsAndTackles({ site_id, status, category, search }) {
        await this.ensureTables();
        let query = `
            SELECT t.*, s.site_name, s.site_code,
                   TO_CHAR(t.calibration_date, 'YYYY-MM-DD') as calibration_date_fmt,
                   TO_CHAR(t.calibration_date, 'DD-Mon-YYYY') as calibration_date_display,
                   TO_CHAR(t.valid_till, 'YYYY-MM-DD') as valid_till_fmt,
                   TO_CHAR(t.valid_till, 'DD-Mon-YYYY') as valid_till_display,
                   t.valid_till - CURRENT_DATE as days_remaining,
                   CASE 
                       WHEN t.valid_till < CURRENT_DATE THEN 'EXPIRED'
                       WHEN t.valid_till <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
                       ELSE 'VALID'
                   END as computed_status
            FROM site_tools_tackles t
            LEFT JOIN sites s ON t.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        let pIndex = 1;

        if (site_id && site_id !== 'ALL') {
            query += ` AND t.site_id = $${pIndex++}`;
            params.push(parseInt(site_id));
        }
        if (category && category !== 'ALL') {
            query += ` AND t.category = $${pIndex++}`;
            params.push(category);
        }
        if (search) {
            query += ` AND (t.tool_name ILIKE $${pIndex} OR t.tpi_agency ILIKE $${pIndex} OR t.certificate_no ILIKE $${pIndex} OR t.make_model ILIKE $${pIndex})`;
            params.push(`%${search}%`);
            pIndex++;
        }

        query += ` ORDER BY CASE WHEN t.valid_till < CURRENT_DATE THEN 1 WHEN t.valid_till <= CURRENT_DATE + INTERVAL '30 days' THEN 2 ELSE 3 END, t.valid_till ASC`;
        const res = await pool.query(query, params);

        // Filter computed status if passed
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

        const res = await pool.query(`
            INSERT INTO site_tools_tackles (
                site_id, tool_name, category, quantity, serial_no,
                make_model, tpi_agency, certificate_no, calibration_date,
                valid_till, certificate_url, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            site_id ? parseInt(site_id) : null,
            tool_name,
            category || 'TESTING_EQUIPMENT',
            quantity ? parseInt(quantity) : 1,
            serial_no || '',
            make_model || '',
            tpi_agency || '',
            certificate_no || '',
            calibration_date || null,
            valid_till,
            certificate_url || null,
            remarks || ''
        ]);
        return res.rows[0];
    }

    async updateTool(id, data) {
        await this.ensureTables();
        const {
            site_id, tool_name, category, quantity, serial_no,
            make_model, tpi_agency, certificate_no, calibration_date,
            valid_till, certificate_url, remarks, status
        } = data;

        const res = await pool.query(`
            UPDATE site_tools_tackles SET
                site_id = $1,
                tool_name = COALESCE($2, tool_name),
                category = COALESCE($3, category),
                quantity = COALESCE($4, quantity),
                serial_no = COALESCE($5, serial_no),
                make_model = COALESCE($6, make_model),
                tpi_agency = COALESCE($7, tpi_agency),
                certificate_no = COALESCE($8, certificate_no),
                calibration_date = $9,
                valid_till = COALESCE($10, valid_till),
                certificate_url = COALESCE($11, certificate_url),
                remarks = COALESCE($12, remarks),
                status = COALESCE($13, status)
            WHERE tool_id = $14
            RETURNING *
        `, [
            site_id ? parseInt(site_id) : null,
            tool_name, category, quantity ? parseInt(quantity) : null, serial_no,
            make_model, tpi_agency, certificate_no, calibration_date || null,
            valid_till, certificate_url || null, remarks, status,
            parseInt(id)
        ]);
        return res.rows[0];
    }

    async deleteTool(id) {
        await this.ensureTables();
        await pool.query('DELETE FROM site_tools_tackles WHERE tool_id = $1', [parseInt(id)]);
        return { success: true };
    }
}

module.exports = new SiteOperationsService();
