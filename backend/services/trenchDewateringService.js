const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

// All 87 records provided from site
const SEED_DATA = [
    { date: '2026-05-21', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 3, unskilled: 2, pumps: 1, remarks: '' },
    { date: '2026-05-22', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 4, unskilled: 0, pumps: 2, remarks: '' },
    { date: '2026-05-23', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 3, unskilled: 0, pumps: 2, remarks: '' },
    { date: '2026-05-25', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 3, unskilled: 1, pumps: 2, remarks: '' },
    { date: '2026-05-26', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 4, unskilled: 1, pumps: 2, remarks: '' },
    { date: '2026-05-27', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 3, pumps: 2, remarks: '' },
    { date: '2026-05-28', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-05-29', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 2, pumps: 1, remarks: '' },
    { date: '2026-06-01', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 1, remarks: '' },
    { date: '2026-06-27', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 2, remarks: '' },
    { date: '2026-06-29', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-06-30', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-01', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 0, pumps: 2, remarks: '' },
    { date: '2026-07-02', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 3, remarks: '' },
    { date: '2026-07-03', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 3, unskilled: 2, pumps: 2, remarks: '1 MOTOR , 1 DIESEL PUMP' },
    { date: '2026-07-04', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 5, unskilled: 2, pumps: 3, remarks: '1 MOTOR , 2DIESEL PUMP' },
    { date: '2026-07-07', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 3, remarks: '1 MOTOR , 2DIESEL PUMP' },
    { date: '2026-07-08', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 2, pumps: 2, remarks: '1 MOTOR , 1 DIESEL PUMP' },
    { date: '2026-07-09', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 2, remarks: '' },
    { date: '2026-07-10', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-11', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-13', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 3, remarks: '' },
    { date: '2026-07-14', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-07-15', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-07-16', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-07-17', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-07-18', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '' },
    { date: '2026-07-20', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 5, pumps: 2, remarks: '' },
    { date: '2026-07-21', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 2, unskilled: 7, pumps: 4, remarks: '3 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-07-24', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-25', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-27', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '' },
    { date: '2026-07-28', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 4, remarks: '3 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-07-29', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 4, remarks: '3 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-07-30', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '2 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-07-31', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '2 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-08-01', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '2 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-08-03', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 4, remarks: '3 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-08-04', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-05', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-06', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 4, remarks: '3 MOTOR, 1 DIESEL PUMP' },
    { date: '2026-08-07', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-08', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-10', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-11', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 7, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-12', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-13', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-14', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-17', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-18', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-19', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-08-20', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-21', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-22', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 1, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-24', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-25', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-26', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-27', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-28', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-29', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-08-31', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-01', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-02', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-03', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-04', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-05', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-07', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-08', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-09', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-10', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-11', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-12', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-15', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-09-16', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-18', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-19', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-21', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-22', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-23', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-24', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-25', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-26', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-28', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-09-30', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-10-01', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-10-03', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-05', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 3, remarks: '3 MOTOR' },
    { date: '2026-10-06', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-07', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-08', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-09', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-10', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-12', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-13', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-14', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 2, pumps: 2, remarks: '2 MOTOR' },
    { date: '2026-10-15', desc: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.', skilled: 1, unskilled: 3, pumps: 2, remarks: '2 MOTOR' }
];

class TrenchDewateringService {
    /**
     * Ensure table exists and auto-seed the 87 records
     */
    async ensureTable() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS trench_dewatering_logs (
                    log_id SERIAL PRIMARY KEY,
                    site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                    project_name VARCHAR(200) DEFAULT 'GTPL LUMINA, AIROLI, MUMBAI',
                    log_date DATE NOT NULL,
                    work_description TEXT NOT NULL DEFAULT '11 KV CABLE TRENCH OPENING DEWATERING AND CLEANING WORK.',
                    skilled_manpower INTEGER NOT NULL DEFAULT 0,
                    unskilled_manpower INTEGER NOT NULL DEFAULT 0,
                    total_manpower INTEGER DEFAULT 0,
                    pumps_count INTEGER NOT NULL DEFAULT 0,
                    motor_pumps INTEGER DEFAULT 0,
                    diesel_pumps INTEGER DEFAULT 0,
                    remarks TEXT,
                    status VARCHAR(50) DEFAULT 'VERIFIED',
                    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(site_id, log_date)
                );
                CREATE INDEX IF NOT EXISTS idx_tdl_site_date ON trench_dewatering_logs(site_id, log_date);
            `);

            // Check if seeded
            const countRes = await pool.query('SELECT COUNT(*) FROM trench_dewatering_logs');
            if (parseInt(countRes.rows[0]?.count || 0) === 0) {
                // Find or insert GTPL LUMINA site
                let siteId = null;
                const siteCheck = await pool.query("SELECT site_id FROM sites WHERE site_name ILIKE '%Lumina%' OR site_code = 'GTPL-LUMINA'");
                if (siteCheck.rows.length > 0) {
                    siteId = siteCheck.rows[0].site_id;
                } else {
                    const sIns = await pool.query(`
                        INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
                        VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
                        RETURNING site_id
                    `);
                    siteId = sIns.rows[0].site_id;
                }

                // Batch insert records
                for (const row of SEED_DATA) {
                    const rem = (row.remarks || '').trim();
                    let motor = 0;
                    let diesel = 0;

                    if (rem.includes('MOTOR')) {
                        const mMatch = rem.match(/(\d+)\s*MOTOR/i);
                        if (mMatch) motor = parseInt(mMatch[1]);
                    }
                    if (rem.includes('DIESEL')) {
                        const dMatch = rem.match(/(\d+)\s*DIESEL/i);
                        if (dMatch) diesel = parseInt(dMatch[1]);
                    }
                    if (motor === 0 && diesel === 0 && row.pumps > 0) {
                        motor = row.pumps; // default to electric submersible motor
                    }

                    const totalMan = (row.skilled || 0) + (row.unskilled || 0);

                    await pool.query(`
                        INSERT INTO trench_dewatering_logs (
                            site_id, project_name, log_date, work_description,
                            skilled_manpower, unskilled_manpower, total_manpower,
                            pumps_count, motor_pumps, diesel_pumps, remarks, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'VERIFIED')
                        ON CONFLICT (site_id, log_date) DO NOTHING
                    `, [
                        siteId,
                        'GTPL LUMINA, AIROLI, MUMBAI',
                        row.date,
                        row.desc,
                        row.skilled,
                        row.unskilled,
                        totalMan,
                        row.pumps,
                        motor,
                        diesel,
                        rem
                    ]);
                }
            }
        } catch (err) {
            console.warn('trench_dewatering_logs ensureTable notice:', err.message);
        }
    }

    /**
     * Get logs with optional filters
     */
    async getLogs({ site_id, month, year, search, start_date, end_date } = {}) {
        await this.ensureTable();

        let query = `
            SELECT 
                l.log_id,
                l.site_id,
                l.project_name,
                TO_CHAR(l.log_date, 'YYYY-MM-DD') as log_date,
                TO_CHAR(l.log_date, 'DD/MM/YYYY') as log_date_formatted,
                TO_CHAR(l.log_date, 'DD-Mon-YYYY') as log_date_display,
                l.work_description,
                l.skilled_manpower,
                l.unskilled_manpower,
                (l.skilled_manpower + l.unskilled_manpower) as total_manpower,
                l.pumps_count,
                l.motor_pumps,
                l.diesel_pumps,
                l.remarks,
                l.status,
                s.site_name,
                s.site_code
            FROM trench_dewatering_logs l
            LEFT JOIN sites s ON l.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];

        if (site_id && site_id !== 'ALL') {
            params.push(parseInt(site_id));
            query += ` AND l.site_id = $${params.length}`;
        }

        if (month && month !== 'ALL') {
            params.push(parseInt(month));
            query += ` AND EXTRACT(MONTH FROM l.log_date) = $${params.length}`;
        }

        if (year && year !== 'ALL') {
            params.push(parseInt(year));
            query += ` AND EXTRACT(YEAR FROM l.log_date) = $${params.length}`;
        }

        if (start_date) {
            params.push(start_date);
            query += ` AND l.log_date >= $${params.length}`;
        }

        if (end_date) {
            params.push(end_date);
            query += ` AND l.log_date <= $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (l.work_description ILIKE $${params.length} OR l.remarks ILIKE $${params.length})`;
        }

        query += ` ORDER BY l.log_date ASC`;

        const res = await pool.query(query, params);
        return res.rows;
    }

    /**
     * Get aggregate analytics
     */
    async getStats({ site_id, month, year } = {}) {
        await this.ensureTable();

        let baseWhere = 'WHERE 1=1';
        const params = [];

        if (site_id && site_id !== 'ALL') {
            params.push(parseInt(site_id));
            baseWhere += ` AND site_id = $${params.length}`;
        }

        if (month && month !== 'ALL') {
            params.push(parseInt(month));
            baseWhere += ` AND EXTRACT(MONTH FROM log_date) = $${params.length}`;
        }

        if (year && year !== 'ALL') {
            params.push(parseInt(year));
            baseWhere += ` AND EXTRACT(YEAR FROM log_date) = $${params.length}`;
        }

        const totalsQuery = `
            SELECT 
                COUNT(*)::int as total_records,
                COALESCE(SUM(skilled_manpower), 0)::int as total_skilled,
                COALESCE(SUM(unskilled_manpower), 0)::int as total_unskilled,
                COALESCE(SUM(skilled_manpower + unskilled_manpower), 0)::int as total_manpower,
                COALESCE(SUM(pumps_count), 0)::int as total_pumps,
                COALESCE(SUM(motor_pumps), 0)::int as total_motor_pumps,
                COALESCE(SUM(diesel_pumps), 0)::int as total_diesel_pumps,
                MIN(log_date) as start_date,
                MAX(log_date) as end_date
            FROM trench_dewatering_logs
            ${baseWhere}
        `;
        const totalsRes = await pool.query(totalsQuery, params);

        // Monthly breakdown
        const monthlyQuery = `
            SELECT 
                TO_CHAR(log_date, 'Mon YYYY') as month_label,
                EXTRACT(MONTH FROM log_date)::int as month_num,
                EXTRACT(YEAR FROM log_date)::int as year_num,
                COUNT(*)::int as days_count,
                SUM(skilled_manpower)::int as skilled,
                SUM(unskilled_manpower)::int as unskilled,
                SUM(skilled_manpower + unskilled_manpower)::int as total_manpower,
                SUM(pumps_count)::int as pumps,
                SUM(motor_pumps)::int as motor_pumps,
                SUM(diesel_pumps)::int as diesel_pumps
            FROM trench_dewatering_logs
            ${baseWhere}
            GROUP BY TO_CHAR(log_date, 'Mon YYYY'), EXTRACT(MONTH FROM log_date), EXTRACT(YEAR FROM log_date)
            ORDER BY year_num ASC, month_num ASC
        `;
        const monthlyRes = await pool.query(monthlyQuery, params);

        return {
            summary: totalsRes.rows[0] || {},
            monthlyBreakdown: monthlyRes.rows || []
        };
    }

    /**
     * Create single log entry
     */
    async createLog(data, userId = null) {
        await this.ensureTable();
        const {
            site_id, project_name, log_date, work_description,
            skilled_manpower, unskilled_manpower, pumps_count,
            motor_pumps, diesel_pumps, remarks, status
        } = data;

        const skilled = parseInt(skilled_manpower) || 0;
        const unskilled = parseInt(unskilled_manpower) || 0;
        const pumps = parseInt(pumps_count) || 0;
        const motor = parseInt(motor_pumps) || 0;
        const diesel = parseInt(diesel_pumps) || 0;
        const total = skilled + unskilled;

        const query = `
            INSERT INTO trench_dewatering_logs (
                site_id, project_name, log_date, work_description,
                skilled_manpower, unskilled_manpower, total_manpower,
                pumps_count, motor_pumps, diesel_pumps, remarks, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const res = await pool.query(query, [
            site_id || null,
            project_name || 'GTPL LUMINA, AIROLI, MUMBAI',
            log_date,
            work_description || '11 KV CABLE TRENCH OPENING DEWATERING AND CLEANING WORK.',
            skilled,
            unskilled,
            total,
            pumps,
            motor,
            diesel,
            remarks || '',
            status || 'VERIFIED',
            userId
        ]);
        return res.rows[0];
    }

    /**
     * Update log entry
     */
    async updateLog(logId, data) {
        await this.ensureTable();
        const {
            work_description, skilled_manpower, unskilled_manpower,
            pumps_count, motor_pumps, diesel_pumps, remarks, status
        } = data;

        const skilled = parseInt(skilled_manpower) || 0;
        const unskilled = parseInt(unskilled_manpower) || 0;
        const pumps = parseInt(pumps_count) || 0;
        const motor = parseInt(motor_pumps) || 0;
        const diesel = parseInt(diesel_pumps) || 0;
        const total = skilled + unskilled;

        const query = `
            UPDATE trench_dewatering_logs SET
                work_description = COALESCE($1, work_description),
                skilled_manpower = $2,
                unskilled_manpower = $3,
                total_manpower = $4,
                pumps_count = $5,
                motor_pumps = $6,
                diesel_pumps = $7,
                remarks = $8,
                status = COALESCE($9, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE log_id = $10
            RETURNING *
        `;
        const res = await pool.query(query, [
            work_description, skilled, unskilled, total, pumps,
            motor, diesel, remarks, status, logId
        ]);
        return res.rows[0];
    }

    /**
     * Delete log entry
     */
    async deleteLog(logId) {
        await this.ensureTable();
        await pool.query('DELETE FROM trench_dewatering_logs WHERE log_id = $1', [logId]);
        return { success: true };
    }

    /**
     * Generate Professional Client Measurement & Joint Verification PDF
     */
    async generatePdf(filters = {}, res) {
        const logs = await this.getLogs(filters);
        const stats = await this.getStats(filters);

        const doc = new PDFDocument({ margin: 35, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="11KV_Trench_Dewatering_Sheet_${Date.now()}.pdf"`);
        doc.pipe(res);

        // Header
        doc.rect(35, 35, 525, 60).fill('#0f172a');
        doc.fillColor('#38bdf8').fontSize(14).font('Helvetica-Bold').text('NKD POWER SOLUTIONS PVT LTD', 45, 45);
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('SITE OPERATIONS & INFRASTRUCTURE DIVISION', 45, 62);
        doc.fillColor('#94a3b8').fontSize(8).text('Head Office: Mumbai, Maharashtra | Contact: operations@nkdgroup.com', 45, 75);

        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('CLIENT MEASUREMENT RECORD', 380, 50, { align: 'right' });
        doc.fillColor('#38bdf8').fontSize(8).font('Helvetica').text('11KV TRENCH DEWATERING', 380, 65, { align: 'right' });

        // Project details bar
        let y = 105;
        doc.rect(35, y, 525, 45).fill('#f1f5f9');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold').text('Project Name:', 45, y + 8);
        doc.font('Helvetica').text('GTPL LUMINA DATA CENTER, AIROLI, NAVI MUMBAI', 115, y + 8);

        doc.font('Helvetica-Bold').text('End Client:', 45, y + 24);
        doc.font('Helvetica').text('LUMINA INFRASTRUCTURE', 115, y + 24);

        doc.font('Helvetica-Bold').text('Work Scope:', 320, y + 8);
        doc.font('Helvetica').text('11kV Cable Trench Dewatering & Cleaning', 385, y + 8);

        doc.font('Helvetica-Bold').text('Total Records:', 320, y + 24);
        doc.font('Helvetica').text(`${logs.length} Days Operating Period`, 385, y + 24);

        // KPI Box
        y = 160;
        const s = stats.summary || {};
        doc.rect(35, y, 125, 36).fill('#ecfdf5').stroke('#a7f3d0');
        doc.fillColor('#065f46').fontSize(7).font('Helvetica-Bold').text('SKILLED MANPOWER', 45, y + 6);
        doc.fontSize(13).text(`${s.total_skilled || 0} Mandays`, 45, y + 17);

        doc.rect(168, y, 125, 36).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7).font('Helvetica-Bold').text('UNSKILLED MANPOWER', 178, y + 6);
        doc.fontSize(13).text(`${s.total_unskilled || 0} Mandays`, 178, y + 17);

        doc.rect(301, y, 125, 36).fill('#fef3c7').stroke('#fde68a');
        doc.fillColor('#92400e').fontSize(7).font('Helvetica-Bold').text('DEWATERING PUMPS', 311, y + 6);
        doc.fontSize(13).text(`${s.total_pumps || 0} Pump Units`, 311, y + 17);

        doc.rect(434, y, 126, 36).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7).font('Helvetica-Bold').text('PUMP BREAKDOWN', 444, y + 6);
        doc.fontSize(10).text(`${s.total_motor_pumps || 0} Motors / ${s.total_diesel_pumps || 0} Diesels`, 444, y + 19);

        // Table Header
        y = 208;
        doc.rect(35, y, 525, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        doc.text('SR', 40, y + 6, { width: 20 });
        doc.text('DATE', 65, y + 6, { width: 60 });
        doc.text('DESCRIPTION OF WORK', 130, y + 6, { width: 170 });
        doc.text('SKILLED', 305, y + 6, { width: 45, align: 'center' });
        doc.text('UNSKILLED', 355, y + 6, { width: 50, align: 'center' });
        doc.text('PUMPS', 410, y + 6, { width: 40, align: 'center' });
        doc.text('EQUIPMENT / REMARKS', 455, y + 6, { width: 100 });

        y += 20;

        logs.forEach((log, index) => {
            if (y > 750) {
                doc.addPage();
                y = 40;
                // Repeat header on new page
                doc.rect(35, y, 525, 18).fill('#1e293b');
                doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                doc.text('SR', 40, y + 5, { width: 20 });
                doc.text('DATE', 65, y + 5, { width: 60 });
                doc.text('DESCRIPTION OF WORK', 130, y + 5, { width: 170 });
                doc.text('SKILLED', 305, y + 5, { width: 45, align: 'center' });
                doc.text('UNSKILLED', 355, y + 5, { width: 50, align: 'center' });
                doc.text('PUMPS', 410, y + 5, { width: 40, align: 'center' });
                doc.text('EQUIPMENT / REMARKS', 455, y + 5, { width: 100 });
                y += 18;
            }

            const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(35, y, 525, 16).fill(rowBg);

            doc.fillColor('#334155').fontSize(7).font('Helvetica');
            doc.text(String(index + 1), 40, y + 4, { width: 20 });
            doc.font('Helvetica-Bold').text(log.log_date_display || log.log_date, 65, y + 4, { width: 60 });
            doc.font('Helvetica').text('11kV Trench Dewatering & Cleaning', 130, y + 4, { width: 170, ellipsis: true });
            doc.text(String(log.skilled_manpower), 305, y + 4, { width: 45, align: 'center' });
            doc.text(String(log.unskilled_manpower), 355, y + 4, { width: 50, align: 'center' });
            doc.font('Helvetica-Bold').text(String(log.pumps_count), 410, y + 4, { width: 40, align: 'center' });
            doc.font('Helvetica').text(log.remarks || `${log.motor_pumps} MOTOR`, 455, y + 4, { width: 100, ellipsis: true });

            y += 16;
        });

        // Signatures block
        if (y > 700) {
            doc.addPage();
            y = 50;
        } else {
            y += 25;
        }

        doc.rect(35, y, 525, 60).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
        doc.text('Prepared By:', 50, y + 10);
        doc.font('Helvetica').fontSize(7.5).text('NKD Site Engineer\nNKD Power Solutions Pvt Ltd', 50, y + 25);

        doc.font('Helvetica-Bold').fontSize(8).text('Verified & Measured By:', 220, y + 10);
        doc.font('Helvetica').fontSize(7.5).text('Client Project Engineer\nLumina Infrastructure Team', 220, y + 25);

        doc.font('Helvetica-Bold').fontSize(8).text('Approved For Billing:', 390, y + 10);
        doc.font('Helvetica').fontSize(7.5).text('Project Director / EHS Lead\nJoint Verification Sign-off', 390, y + 25);

        doc.end();
    }
}

module.exports = new TrenchDewateringService();

