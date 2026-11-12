const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const cleanDate = (val) => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s === '' ? null : s.slice(0, 10);
};

const cleanNum = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const cleanInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : n;
};

const getIstToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

const formatDisplayDate = (val) => {
    if (!val) return 'N/A';
    const str = String(val).slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!match) return str;
    return `${match[3]}/${match[2]}/${match[1]}`;
};

const computeManpowerTotal = (manpowerData) => {
    if (!Array.isArray(manpowerData)) return 0;
    return manpowerData.reduce((sum, item) => sum + (parseInt(item?.available || 0, 10) || 0), 0);
};

class DprService {
    constructor() {
        this.initPromise = null;
    }

    /**
     * Ensure DPR table and sample records exist (Self-healing schema, run once per lifecycle)
     */
    async ensureDprTable() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS daily_progress_reports (
                        dpr_id SERIAL PRIMARY KEY,
                        report_no VARCHAR(100) UNIQUE NOT NULL,
                        site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                        report_date DATE NOT NULL DEFAULT CURRENT_DATE,
                        client_name VARCHAR(200) NOT NULL,
                        contractor_name VARCHAR(200) DEFAULT 'NKD POWER SOLUTIONS PVT LTD',
                        po_number VARCHAR(100),
                        po_value NUMERIC(15,2) DEFAULT 0,
                        current_billing_value NUMERIC(15,2) DEFAULT 0,
                        billing_progress_pct NUMERIC(5,2) DEFAULT 0,
                        start_date DATE,
                        completion_date DATE,
                        today_activities JSONB DEFAULT '[]'::jsonb,
                        next_day_activities JSONB DEFAULT '[]'::jsonb,
                        show_stoppers JSONB DEFAULT '[]'::jsonb,
                        manpower_data JSONB DEFAULT '[]'::jsonb,
                        photos JSONB DEFAULT '[]'::jsonb,
                        created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_dpr_site ON daily_progress_reports(site_id);
                    CREATE INDEX IF NOT EXISTS idx_dpr_date ON daily_progress_reports(report_date);
                    ALTER TABLE daily_progress_reports ADD COLUMN IF NOT EXISTS excel_grid JSONB DEFAULT NULL;
                    ALTER TABLE daily_progress_reports ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
                    ALTER TABLE sites ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
                    ALTER TABLE sites ADD COLUMN IF NOT EXISTS excel_grid JSONB DEFAULT NULL;
                `);

                // Seed sample GTPL LUMINA/124 report if table is empty
                const cnt = await pool.query('SELECT COUNT(*)::int AS cnt FROM daily_progress_reports');
                if ((cnt.rows[0]?.cnt || 0) === 0) {
                    let siteId = null;
                    const siteRes = await pool.query("SELECT site_id FROM sites WHERE site_name ILIKE '%Lumina%' OR site_code = 'GTPL-LUMINA' LIMIT 1");
                    if (siteRes.rows.length > 0) {
                        siteId = siteRes.rows[0].site_id;
                    } else {
                        const s = await pool.query(`
                            INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
                            VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
                            ON CONFLICT (site_code) DO UPDATE SET is_active = TRUE
                            RETURNING site_id
                        `);
                        siteId = s.rows[0]?.site_id || null;
                    }

                    await pool.query(`
                        INSERT INTO daily_progress_reports (
                            report_no, site_id, report_date, client_name, contractor_name,
                            po_number, po_value, current_billing_value, billing_progress_pct,
                            start_date, completion_date,
                            today_activities, next_day_activities, show_stoppers, manpower_data, photos
                        ) VALUES (
                            'GTPL LUMINA/124', $1, '2026-10-23', 'LUMINA', 'NKD POWER SOLUTIONS PVT LTD',
                            '600190', 48374200.00, 0.00, 0.00, '2026-04-16', '2026-07-24',
                            $2, $3, $4, $5, $6
                        )
                        ON CONFLICT (report_no) DO NOTHING
                    `, [
                        siteId,
                        JSON.stringify([{ id: 1, description: 'Roxtec material unloading and shifting work, [Engaged Manpower: 07]', status: 'complete', dependencies: 'NKD', photo_ref: 'Photo 1' }]),
                        JSON.stringify([{ id: 1, description: '11 kV trench core cutting (cellar room) and 11KV cable pulling in cellar.', dependencies: 'Civil Clearance' }]),
                        JSON.stringify([{ id: 1, concern_area: 'Substation cellar water seepage clearance from Lumina civil team', intimation_date: '2026-10-20' }]),
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
                }
            } catch (err) {
                this.initPromise = null;
                console.warn('ensureDprTable auto-recovery notice:', err.message);
            }
        })();

        return this.initPromise;
    }

    /**
     * Get list of all DPRs with optional filters
     */
    async getAllDprs({ site_id, search, start_date, end_date } = {}) {
        await this.ensureDprTable();
        let query = `
            SELECT
                d.dpr_id,
                d.report_no,
                d.site_id,
                TO_CHAR(d.report_date, 'YYYY-MM-DD') AS report_date,
                d.client_name,
                d.contractor_name,
                d.po_number,
                d.po_value,
                d.current_billing_value,
                d.billing_progress_pct,
                TO_CHAR(d.start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(d.completion_date, 'YYYY-MM-DD') AS completion_date,
                d.today_activities,
                d.next_day_activities,
                d.show_stoppers,
                d.manpower_data,
                d.photos,
                d.created_by,
                d.created_at,
                d.updated_at,
                s.site_name,
                s.site_code,
                s.city AS site_city,
                u.email AS created_by_email
            FROM daily_progress_reports d
            LEFT JOIN sites s ON d.site_id = s.site_id
            LEFT JOIN users u ON d.created_by = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (site_id && site_id !== 'ALL') {
            const parsedSite = cleanInt(site_id);
            if (parsedSite) {
                params.push(parsedSite);
                query += ` AND d.site_id = $${params.length}`;
            }
        }

        if (search && String(search).trim() !== '') {
            params.push(`%${String(search).trim()}%`);
            query += ` AND (d.report_no ILIKE $${params.length} OR d.client_name ILIKE $${params.length} OR COALESCE(s.site_name, '') ILIKE $${params.length} OR COALESCE(d.po_number, '') ILIKE $${params.length})`;
        }

        if (start_date) {
            params.push(start_date);
            query += ` AND d.report_date >= $${params.length}`;
        }

        if (end_date) {
            params.push(end_date);
            query += ` AND d.report_date <= $${params.length}`;
        }

        query += ` ORDER BY d.report_date DESC, d.dpr_id DESC`;
        const result = await pool.query(query, params);
        return result.rows.map(r => ({
            ...r,
            manpower_total: computeManpowerTotal(r.manpower_data)
        }));
    }

    /**
     * Get single DPR by ID
     */
    async getDprById(id) {
        await this.ensureDprTable();
        const query = `
            SELECT
                d.dpr_id,
                d.report_no,
                d.site_id,
                TO_CHAR(d.report_date, 'YYYY-MM-DD') AS report_date,
                d.client_name,
                d.contractor_name,
                d.po_number,
                d.po_value,
                d.current_billing_value,
                d.billing_progress_pct,
                TO_CHAR(d.start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(d.completion_date, 'YYYY-MM-DD') AS completion_date,
                d.today_activities,
                d.next_day_activities,
                d.show_stoppers,
                d.manpower_data,
                d.photos,
                d.created_by,
                d.created_at,
                d.updated_at,
                s.site_name,
                s.site_code,
                s.address AS site_address,
                s.city AS site_city,
                s.state AS site_state,
                u.email AS created_by_email
            FROM daily_progress_reports d
            LEFT JOIN sites s ON d.site_id = s.site_id
            LEFT JOIN users u ON d.created_by = u.user_id
            WHERE d.dpr_id = $1
        `;
        const result = await pool.query(query, [cleanInt(id)]);
        const row = result.rows[0];
        if (!row) return null;
        return {
            ...row,
            manpower_total: computeManpowerTotal(row.manpower_data)
        };
    }

    async generateNextReportNo(siteId) {
        let sitePrefix = 'DPR';
        if (siteId) {
            const s = await pool.query('SELECT site_code, site_name FROM sites WHERE site_id = $1', [siteId]);
            if (s.rows[0]) {
                sitePrefix = (s.rows[0].site_code || s.rows[0].site_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)).toUpperCase();
            }
        }
        const existingRes = await pool.query(
            'SELECT report_no FROM daily_progress_reports WHERE site_id IS NOT DISTINCT FROM $1 OR report_no ILIKE $2',
            [siteId, `${sitePrefix}/%`]
        );
        let maxNum = 0;
        for (const r of existingRes.rows) {
            const match = /(\d+)\s*$/.exec(String(r.report_no || ''));
            if (match) {
                const n = parseInt(match[1], 10);
                if (!Number.isNaN(n) && n > maxNum) maxNum = n;
            }
        }
        return `${sitePrefix}/${String(maxNum + 1).padStart(3, '0')}`;
    }

    /**
     * Create new DPR
     */
    async createDpr(data, userId = null) {
        await this.ensureDprTable();
        const siteId = cleanInt(data.site_id);
        let reportNo = data.report_no && String(data.report_no).trim() !== ''
            ? String(data.report_no).trim()
            : await this.generateNextReportNo(siteId);

        const poValue = cleanNum(data.po_value, 0);
        const billingVal = cleanNum(data.current_billing_value, 0);
        let billingPct = cleanNum(data.billing_progress_pct, null);
        if (billingPct === null) {
            billingPct = poValue > 0 ? Math.min(100, Math.round((billingVal / poValue) * 10000) / 100) : 0;
        }

        const query = `
            INSERT INTO daily_progress_reports (
                report_no, site_id, report_date, client_name, contractor_name,
                po_number, po_value, current_billing_value, billing_progress_pct,
                start_date, completion_date,
                today_activities, next_day_activities, show_stoppers, manpower_data, photos, excel_grid,
                created_by
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11,
                $12, $13, $14, $15, $16, $17,
                $18
            ) RETURNING *,
              TO_CHAR(report_date, 'YYYY-MM-DD') AS report_date,
              TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(completion_date, 'YYYY-MM-DD') AS completion_date
        `;

        const values = [
            reportNo,
            siteId,
            cleanDate(data.report_date) || getIstToday(),
            (data.client_name && String(data.client_name).trim()) || 'LUMINA',
            (data.contractor_name && String(data.contractor_name).trim()) || 'NKD POWER SOLUTIONS PVT LTD',
            data.po_number || '',
            poValue,
            billingVal,
            billingPct,
            cleanDate(data.start_date),
            cleanDate(data.completion_date),
            JSON.stringify(Array.isArray(data.today_activities) ? data.today_activities : []),
            JSON.stringify(Array.isArray(data.next_day_activities) ? data.next_day_activities : []),
            JSON.stringify(Array.isArray(data.show_stoppers) ? data.show_stoppers : []),
            JSON.stringify(Array.isArray(data.manpower_data) ? data.manpower_data : []),
            JSON.stringify(Array.isArray(data.photos) ? data.photos : []),
            JSON.stringify(data.excel_grid && typeof data.excel_grid === 'object' ? data.excel_grid : null),
            cleanInt(userId)
        ];

        try {
            const res = await pool.query(query, values);
            const row = res.rows[0];
            return { ...row, manpower_total: computeManpowerTotal(row.manpower_data) };
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`DPR report number "${reportNo}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    }

    /**
     * Update existing DPR
     */
    async updateDpr(id, data) {
        await this.ensureDprTable();
        const dprId = cleanInt(id);
        const existingRes = await pool.query('SELECT * FROM daily_progress_reports WHERE dpr_id = $1', [dprId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('DPR record not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const poValue = data.po_value !== undefined ? cleanNum(data.po_value, 0) : parseFloat(ex.po_value || 0);
        const billingVal = data.current_billing_value !== undefined
            ? cleanNum(data.current_billing_value, 0)
            : parseFloat(ex.current_billing_value || 0);
        let billingPct = data.billing_progress_pct !== undefined
            ? cleanNum(data.billing_progress_pct, null)
            : parseFloat(ex.billing_progress_pct || 0);
        if (billingPct === null) {
            billingPct = poValue > 0 ? Math.min(100, Math.round((billingVal / poValue) * 10000) / 100) : 0;
        }

        const query = `
            UPDATE daily_progress_reports SET
                report_no = $1,
                site_id = $2,
                report_date = $3,
                client_name = $4,
                contractor_name = $5,
                po_number = $6,
                po_value = $7,
                current_billing_value = $8,
                billing_progress_pct = $9,
                start_date = $10,
                completion_date = $11,
                today_activities = $12,
                next_day_activities = $13,
                show_stoppers = $14,
                manpower_data = $15,
                photos = $16,
                excel_grid = $17,
                updated_at = CURRENT_TIMESTAMP
            WHERE dpr_id = $18
            RETURNING *,
              TO_CHAR(report_date, 'YYYY-MM-DD') AS report_date,
              TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(completion_date, 'YYYY-MM-DD') AS completion_date
        `;

        const values = [
            data.report_no !== undefined && String(data.report_no).trim() !== '' ? String(data.report_no).trim() : ex.report_no,
            data.site_id !== undefined ? cleanInt(data.site_id) : ex.site_id,
            data.report_date !== undefined ? (cleanDate(data.report_date) || ex.report_date) : ex.report_date,
            data.client_name !== undefined ? (String(data.client_name).trim() || ex.client_name) : ex.client_name,
            data.contractor_name !== undefined ? (String(data.contractor_name).trim() || ex.contractor_name) : ex.contractor_name,
            data.po_number !== undefined ? (data.po_number || '') : ex.po_number,
            poValue,
            billingVal,
            billingPct,
            data.start_date !== undefined ? cleanDate(data.start_date) : ex.start_date,
            data.completion_date !== undefined ? cleanDate(data.completion_date) : ex.completion_date,
            JSON.stringify(data.today_activities !== undefined ? (data.today_activities || []) : (ex.today_activities || [])),
            JSON.stringify(data.next_day_activities !== undefined ? (data.next_day_activities || []) : (ex.next_day_activities || [])),
            JSON.stringify(data.show_stoppers !== undefined ? (data.show_stoppers || []) : (ex.show_stoppers || [])),
            JSON.stringify(data.manpower_data !== undefined ? (data.manpower_data || []) : (ex.manpower_data || [])),
            JSON.stringify(data.photos !== undefined ? (data.photos || []) : (ex.photos || [])),
            JSON.stringify(data.excel_grid !== undefined ? (data.excel_grid || null) : (ex.excel_grid || null)),
            dprId
        ];

        try {
            const res = await pool.query(query, values);
            const row = res.rows[0];
            return { ...row, manpower_total: computeManpowerTotal(row.manpower_data) };
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error('DPR report number already exists');
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    }

    /**
     * Delete DPR
     */
    async deleteDpr(id) {
        await this.ensureDprTable();
        const res = await pool.query('DELETE FROM daily_progress_reports WHERE dpr_id = $1 RETURNING dpr_id', [cleanInt(id)]);
        if (res.rows.length === 0) {
            const err = new Error('DPR record not found');
            err.status = 404;
            throw err;
        }
        return { success: true };
    }

    /**
     * Get Site Master DPR Template & Auto-increment next report number
     * Enables 1-click DPR creation without re-entering client & PO details daily
     */
    async getSiteTemplate(siteId) {
        await this.ensureDprTable();
        const id = cleanInt(siteId);
        if (!id) return null;

        const siteRes = await pool.query(`
            SELECT site_id, site_code, site_name, principal_employer_name, main_contractor_name, google_sheet_url, excel_grid
            FROM sites WHERE site_id = $1
        `, [id]);
        if (siteRes.rows.length === 0) return null;
        const site = siteRes.rows[0];

        const lastDprRes = await pool.query(`
            SELECT * FROM daily_progress_reports
            WHERE site_id = $1
            ORDER BY report_date DESC, dpr_id DESC
            LIMIT 1
        `, [id]);

        let nextReportNo = '';
        if (lastDprRes.rows.length > 0) {
            const lastNo = String(lastDprRes.rows[0].report_no || '').trim();
            const match = lastNo.match(/^(.*?)(\d+)$/);
            if (match) {
                const prefix = match[1];
                const numStr = match[2];
                const nextNum = parseInt(numStr, 10) + 1;
                nextReportNo = `${prefix}${String(nextNum).padStart(numStr.length, '0')}`;
            } else {
                nextReportNo = `${lastNo}/001`;
            }

            const last = lastDprRes.rows[0];
            return {
                has_prior_dpr: true,
                isExistingDprSample: true,
                site_id: site.site_id,
                site_name: site.site_name,
                site_code: site.site_code,
                client_name: last.client_name || site.principal_employer_name || '',
                contractor_name: last.contractor_name || 'NKD POWER SOLUTIONS PVT LTD',
                po_number: last.po_number || '',
                po_value: last.po_value ? parseFloat(last.po_value) : 0,
                current_billing_value: last.current_billing_value ? parseFloat(last.current_billing_value) : 0,
                billing_progress_pct: last.billing_progress_pct ? parseFloat(last.billing_progress_pct) : 0,
                start_date: last.start_date ? String(last.start_date).slice(0, 10) : '',
                completion_date: last.completion_date ? String(last.completion_date).slice(0, 10) : '',
                suggested_report_no: nextReportNo,
                nextReportNo: nextReportNo,
                default_manpower: Array.isArray(last.manpower_data) && last.manpower_data.length > 0 ? last.manpower_data : null,
                manpower_data: Array.isArray(last.manpower_data) && last.manpower_data.length > 0 ? last.manpower_data : null,
                excel_grid: last.excel_grid || site.excel_grid || null,
                google_sheet_url: last.google_sheet_url || site.google_sheet_url || ''
            };
        }

        nextReportNo = `${site.site_code || 'DPR'}/001`;
        return {
            has_prior_dpr: false,
            isExistingDprSample: false,
            site_id: site.site_id,
            site_name: site.site_name,
            site_code: site.site_code,
            client_name: site.principal_employer_name || '',
            contractor_name: 'NKD POWER SOLUTIONS PVT LTD',
            po_number: '',
            po_value: 0,
            current_billing_value: 0,
            billing_progress_pct: 0,
            start_date: '',
            completion_date: '',
            suggested_report_no: nextReportNo,
            nextReportNo: nextReportNo,
            default_manpower: null,
            manpower_data: null,
            excel_grid: site.excel_grid || null,
            google_sheet_url: site.google_sheet_url || ''
        };
    }

    /**
     * Get Site-wise Archive & Folders for Backdated DPRs
     * Groups reports by Site, Year-Month, and Date for dedicated site folders
     */
    async getSiteWiseArchive({ site_id } = {}) {
        await this.ensureDprTable();
        let whereClause = '';
        const params = [];
        if (site_id && site_id !== 'ALL') {
            params.push(cleanInt(site_id));
            whereClause = `WHERE d.site_id = $1`;
        }

        const query = `
            SELECT
                d.dpr_id,
                d.report_no,
                d.site_id,
                COALESCE(s.site_name, 'Project Site') AS site_name,
                COALESCE(s.site_code, 'SITE') AS site_code,
                TO_CHAR(d.report_date, 'YYYY-MM-DD') AS report_date,
                TO_CHAR(d.report_date, 'YYYY-MM') AS month_key,
                TO_CHAR(d.report_date, 'FMMonth YYYY') AS month_label,
                d.client_name,
                d.contractor_name,
                d.po_number,
                d.po_value,
                d.billing_progress_pct,
                d.today_activities,
                d.next_day_activities,
                d.manpower_data,
                d.photos
            FROM daily_progress_reports d
            LEFT JOIN sites s ON d.site_id = s.site_id
            ${whereClause}
            ORDER BY s.site_name ASC, d.report_date DESC, d.dpr_id DESC
        `;
        const res = await pool.query(query, params);

        const siteMap = new Map();
        for (const row of res.rows) {
            const sId = row.site_id || 0;
            if (!siteMap.has(sId)) {
                siteMap.set(sId, {
                    site_id: row.site_id,
                    site_name: row.site_name,
                    site_code: row.site_code,
                    total_reports: 0,
                    monthsMap: new Map()
                });
            }
            const siteGroup = siteMap.get(sId);
            siteGroup.total_reports++;

            const mKey = row.month_key || 'Unknown';
            if (!siteGroup.monthsMap.has(mKey)) {
                siteGroup.monthsMap.set(mKey, {
                    month_key: mKey,
                    month_label: (row.month_label || mKey).trim(),
                    reports: []
                });
            }
            siteGroup.monthsMap.get(mKey).reports.push({
                ...row,
                manpower_total: computeManpowerTotal(row.manpower_data),
                photos_count: Array.isArray(row.photos) ? row.photos.length : 0
            });
        }

        return Array.from(siteMap.values()).map(s => ({
            site_id: s.site_id,
            site_name: s.site_name,
            site_code: s.site_code,
            total_reports: s.total_reports,
            months: Array.from(s.monthsMap.values())
        }));
    }

    /**
     * Parse an uploaded Excel spreadsheet file into dynamic columns and rows
     */
    async parseExcelFile(filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('Excel workbook contains no readable sheets');
        }

        const columns = [];
        const rows = [];
        let headerRowIdx = 1;
        let headerRow = worksheet.getRow(1);

        for (let r = 1; r <= 5; r++) {
            const candidate = worksheet.getRow(r);
            const vals = Array.isArray(candidate.values) ? candidate.values.filter(Boolean) : [];
            if (vals.length > 0) {
                headerRowIdx = r;
                headerRow = candidate;
                break;
            }
        }

        const rawHeaders = Array.isArray(headerRow.values) ? headerRow.values : [];
        const colKeys = [];

        rawHeaders.forEach((val, idx) => {
            if (idx === 0) return;
            let title = '';
            if (typeof val === 'object' && val !== null) {
                title = val.text || val.result || JSON.stringify(val);
            } else {
                title = String(val ?? '').trim();
            }
            if (!title) title = `Column ${idx}`;
            const key = `col_${idx}`;
            colKeys.push({ idx, key });
            columns.push({
                key,
                title,
                width: Math.max(100, Math.min(260, title.length * 12))
            });
        });

        if (columns.length === 0) {
            return {
                columns: [
                    { key: 'col_1', title: 'S.No', width: 60 },
                    { key: 'col_2', title: 'Description / Activity', width: 240 },
                    { key: 'col_3', title: 'Location / Grid', width: 140 },
                    { key: 'col_4', title: 'Planned Qty', width: 100 },
                    { key: 'col_5', title: 'Executed Qty', width: 100 },
                    { key: 'col_6', title: 'Unit', width: 80 },
                    { key: 'col_7', title: 'Status', width: 120 },
                    { key: 'col_8', title: 'Remarks', width: 180 }
                ],
                rows: []
            };
        }

        let rowCounter = 1;
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRowIdx) return;
            const rowValues = row.values;
            if (!rowValues || !Array.isArray(rowValues)) return;

            const rowData = { id: `row_${rowCounter++}` };
            let hasAnyVal = false;
            colKeys.forEach(({ idx, key }) => {
                let cellVal = rowValues[idx];
                if (cellVal !== undefined && cellVal !== null) {
                    if (typeof cellVal === 'object') {
                        if (cellVal.result !== undefined) cellVal = cellVal.result;
                        else if (cellVal.text !== undefined) cellVal = cellVal.text;
                        else if (cellVal instanceof Date) cellVal = cellVal.toISOString().slice(0, 10);
                        else cellVal = JSON.stringify(cellVal);
                    }
                    cellVal = String(cellVal).trim();
                    if (cellVal) hasAnyVal = true;
                } else {
                    cellVal = '';
                }
                rowData[key] = cellVal;
            });

            if (hasAnyVal) {
                rows.push(rowData);
            }
        });

        return { columns, rows };
    }

    /**
     * Generate official printable PDF for DPR (with pagination safety)
     */
    async generateDprPdf(dpr, res) {
        const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="DPR-${String(dpr.report_no || dpr.dpr_id).replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
        doc.pipe(res);

        // Header
        doc.rect(36, 36, 523, 56).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
            .text(dpr.contractor_name || 'NKD POWER SOLUTIONS PVT LTD', 48, 46, { width: 370 });
        doc.fontSize(9).font('Helvetica')
            .text('DAILY SITE PROGRESS REPORT (DPR) - ENGINEERING & INFRASTRUCTURE', 48, 64);
        doc.fontSize(8).fillColor('#94a3b8')
            .text(`Generated: ${formatDisplayDate(getIstToday())}`, 430, 48, { align: 'right', width: 118 });

        // Project Info Box
        doc.rect(36, 100, 523, 76).stroke('#cbd5e1');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');

        doc.text('Project:', 44, 108);
        doc.font('Helvetica').text(dpr.site_name || 'Site Project', 95, 108, { width: 215, ellipsis: true });

        doc.font('Helvetica-Bold').text('Client:', 320, 108);
        doc.font('Helvetica').text(dpr.client_name || 'Client', 368, 108, { width: 185, ellipsis: true });

        doc.font('Helvetica-Bold').text('Report No:', 44, 123);
        doc.font('Helvetica-Bold').fillColor('#0284c7').text(dpr.report_no || '-', 100, 123);

        doc.font('Helvetica-Bold').fillColor('#1e293b').text('Date:', 320, 123);
        doc.font('Helvetica').text(formatDisplayDate(dpr.report_date), 368, 123);

        doc.font('Helvetica-Bold').text('PO Number:', 44, 138);
        doc.font('Helvetica').text(dpr.po_number || 'N/A', 105, 138, { width: 205, ellipsis: true });

        doc.font('Helvetica-Bold').text('PO Value:', 320, 138);
        doc.font('Helvetica-Bold').fillColor('#059669').text(`INR ${parseFloat(dpr.po_value || 0).toLocaleString('en-IN')}`, 375, 138);

        doc.font('Helvetica-Bold').fillColor('#1e293b').text('Duration:', 44, 153);
        doc.font('Helvetica').text(`${formatDisplayDate(dpr.start_date)} to ${formatDisplayDate(dpr.completion_date)}`, 95, 153);

        doc.font('Helvetica-Bold').text('Billing Progress:', 320, 153);
        doc.font('Helvetica').text(`${dpr.billing_progress_pct || 0}%`, 400, 153);

        let curY = 188;
        const checkPageSpace = (needed = 40) => {
            if (curY + needed > 770) {
                doc.addPage();
                curY = 40;
            }
        };

        // Section: Today's Activity Status
        checkPageSpace(45);
        doc.rect(36, curY, 523, 18).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text("TODAY'S WORK ACTIVITY STATUS", 44, curY + 4);
        curY += 22;

        const activities = Array.isArray(dpr.today_activities) ? dpr.today_activities : [];
        if (activities.length === 0) {
            doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('No activity items recorded for this date.', 44, curY);
            curY += 16;
        } else {
            activities.forEach((act, idx) => {
                doc.font('Helvetica').fontSize(8);
                const textH = Math.max(14, doc.heightOfString(act.description || '', { width: 325 }));
                checkPageSpace(textH + 8);
                doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(act.description || '', 60, curY, { width: 325 });
                doc.font('Helvetica-Bold').fillColor(act.status === 'complete' ? '#059669' : '#d97706')
                    .text(String(act.status || 'In Progress').toUpperCase(), 395, curY, { width: 75 });
                doc.fillColor('#64748b').font('Helvetica').text(`Dep: ${act.dependencies || 'NKD'}`, 475, curY, { width: 80, ellipsis: true });
                curY += textH + 6;
            });
        }

        curY += 10;

        // Section: Next Day Planning
        checkPageSpace(45);
        doc.rect(36, curY, 523, 18).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text('ACTIVITIES PLANNED FOR NEXT DAY', 44, curY + 4);
        curY += 22;

        const nextDay = Array.isArray(dpr.next_day_activities) ? dpr.next_day_activities : [];
        if (nextDay.length === 0) {
            doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('No carry-forward activities planned.', 44, curY);
            curY += 16;
        } else {
            nextDay.forEach((act, idx) => {
                doc.font('Helvetica').fontSize(8);
                const textH = Math.max(14, doc.heightOfString(act.description || '', { width: 470 }));
                checkPageSpace(textH + 6);
                doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(act.description || '', 60, curY, { width: 470 });
                curY += textH + 5;
            });
        }

        curY += 10;

        // Section: Manpower Deployment Table
        checkPageSpace(60);
        doc.rect(36, curY, 523, 18).fill('#0284c7');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('MANPOWER DEPLOYMENT (TRADE & COUNT)', 44, curY + 4);
        curY += 22;

        const manpower = Array.isArray(dpr.manpower_data) ? dpr.manpower_data : [];
        let totalReq = 0;
        let totalAvail = 0;

        const drawManpowerHeader = () => {
            doc.rect(36, curY, 523, 16).fill('#f8fafc');
            doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
            doc.text('Trade / Skill Category', 44, curY + 4);
            doc.text('Required', 360, curY + 4);
            doc.text('Available (On Site)', 450, curY + 4);
            curY += 18;
        };
        drawManpowerHeader();

        manpower.forEach((mp) => {
            if (curY + 18 > 770) {
                doc.addPage();
                curY = 40;
                drawManpowerHeader();
            }
            const req = parseInt(mp.required || 0, 10) || 0;
            const avail = parseInt(mp.available || 0, 10) || 0;
            totalReq += req;
            totalAvail += avail;

            doc.fillColor('#334155').font('Helvetica').fontSize(8);
            doc.text(mp.trade || 'Worker', 44, curY);
            doc.text(String(req), 375, curY);
            doc.font('Helvetica-Bold').fillColor(avail > 0 ? '#0284c7' : '#94a3b8').text(String(avail), 475, curY);
            curY += 15;
        });

        checkPageSpace(30);
        doc.rect(36, curY, 523, 16).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        doc.text('TOTAL MANPOWER ENGAGED', 44, curY + 4);
        doc.text(String(totalReq), 375, curY + 4);
        doc.fillColor('#0284c7').text(String(totalAvail), 475, curY + 4);
        curY += 24;

        // Showstoppers / Blockers if any
        const stoppers = Array.isArray(dpr.show_stoppers) ? dpr.show_stoppers : [];
        if (stoppers.length > 0) {
            checkPageSpace(45);
            doc.rect(36, curY, 523, 18).fill('#fee2e2');
            doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(9).text('SHOW STOPPERS / CONCERN AREAS', 44, curY + 4);
            curY += 22;
            stoppers.forEach((st, idx) => {
                doc.font('Helvetica').fontSize(8);
                const textH = Math.max(14, doc.heightOfString(st.concern_area || '', { width: 375 }));
                checkPageSpace(textH + 6);
                doc.fillColor('#7f1d1d').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(st.concern_area || '', 60, curY, { width: 375 });
                doc.text(`Intimated: ${formatDisplayDate(st.intimation_date)}`, 445, curY, { width: 110 });
                curY += textH + 6;
            });
            curY += 10;
        }

        // Section: Site Progress Photos & Visual Evidence
        const photos = Array.isArray(dpr.photos) ? dpr.photos : [];
        if (photos.length > 0) {
            checkPageSpace(60);
            doc.rect(36, curY, 523, 18).fill('#0f172a');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
                .text('SITE PROGRESS PHOTOS & VISUAL EVIDENCE', 44, curY + 4);
            curY += 26;

            const photoBoxW = 250;
            const photoBoxH = 140;
            const photoPad = 15;

            for (let i = 0; i < photos.length; i += 2) {
                checkPageSpace(photoBoxH + 30);
                const p1 = photos[i];
                const p2 = photos[i + 1];

                const drawPhotoCard = (photo, x, y, idx) => {
                    doc.rect(x, y, photoBoxW, photoBoxH).stroke('#cbd5e1');
                    doc.rect(x, y, photoBoxW, 18).fill('#f1f5f9');
                    doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(8)
                        .text(photo.photo_ref || `Photo ${idx + 1}`, x + 8, y + 5);

                    let imageDrawn = false;
                    if (photo.url) {
                        const candidates = [
                            path.resolve(__dirname, '..', photo.url.replace(/^\//, '')),
                            path.resolve(__dirname, '../../', photo.url.replace(/^\//, '')),
                            path.resolve(__dirname, '../../uploads', path.basename(photo.url)),
                            path.resolve(__dirname, '../uploads', path.basename(photo.url))
                        ];
                        for (const cand of candidates) {
                            try {
                                if (fs.existsSync(cand) && !cand.endsWith('.svg')) {
                                    doc.image(cand, x + 6, y + 22, {
                                        fit: [photoBoxW - 12, photoBoxH - 52],
                                        align: 'center',
                                        valign: 'center'
                                    });
                                    imageDrawn = true;
                                    break;
                                }
                            } catch (_) {}
                        }
                    }

                    if (!imageDrawn) {
                        doc.rect(x + 6, y + 22, photoBoxW - 12, photoBoxH - 52).fill('#f8fafc');
                        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9)
                            .text('📸 SITE PROGRESS PHOTO', x + 10, y + 45, { align: 'center', width: photoBoxW - 20 });
                        doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
                            .text(photo.url ? path.basename(photo.url) : 'Verified on Site', x + 10, y + 62, { align: 'center', width: photoBoxW - 20 });
                    }

                    doc.rect(x, y + photoBoxH - 26, photoBoxW, 26).fill('#0f172a');
                    doc.fillColor('#ffffff').font('Helvetica').fontSize(7.5)
                        .text(photo.caption || 'Site Activity Progress Evidence', x + 6, y + photoBoxH - 21, {
                            width: photoBoxW - 12,
                            height: 20,
                            ellipsis: true
                        });
                };

                drawPhotoCard(p1, 36, curY, i);
                if (p2) {
                    drawPhotoCard(p2, 36 + photoBoxW + photoPad, curY, i + 1);
                }
                curY += photoBoxH + 16;
            }
        }

        // Custom Dynamic Excel Grid Table if present
        if (dpr.excel_grid && Array.isArray(dpr.excel_grid.columns) && dpr.excel_grid.columns.length > 0 && Array.isArray(dpr.excel_grid.rows) && dpr.excel_grid.rows.length > 0) {
            checkPageSpace(60);
            doc.rect(36, curY, 523, 18).fill('#0f172a');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
                .text('CUSTOM SITE WORK BREAKDOWN SHEET', 44, curY + 4);
            curY += 24;

            const cols = dpr.excel_grid.columns.slice(0, 8);
            const colWidth = Math.floor(523 / cols.length);

            checkPageSpace(20);
            doc.rect(36, curY, 523, 16).fill('#f1f5f9');
            cols.forEach((col, idx) => {
                doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(7.5)
                    .text(col.title || `Col ${idx + 1}`, 36 + (idx * colWidth) + 4, curY + 4, {
                        width: colWidth - 8,
                        ellipsis: true
                    });
            });
            curY += 18;

            dpr.excel_grid.rows.forEach((r, rIdx) => {
                checkPageSpace(16);
                if (rIdx % 2 === 1) {
                    doc.rect(36, curY - 2, 523, 14).fill('#f8fafc');
                }
                cols.forEach((col, idx) => {
                    const val = String(r[col.key] ?? '');
                    doc.fillColor('#334155').font('Helvetica').fontSize(7)
                        .text(val, 36 + (idx * colWidth) + 4, curY, {
                            width: colWidth - 8,
                            ellipsis: true
                        });
                });
                curY += 14;
            });
            curY += 10;
        }

        // Signatures block safely placed
        if (curY > 710) {
            doc.addPage();
            curY = 50;
        }
        const signY = Math.max(curY + 20, 740);
        doc.strokeColor('#cbd5e1').lineWidth(1)
            .moveTo(44, signY).lineTo(180, signY).stroke()
            .moveTo(380, signY).lineTo(520, signY).stroke();

        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text('SITE IN-CHARGE / ENGINEER', 44, signY + 6)
            .text(dpr.contractor_name || 'NKD Power Solutions Pvt Ltd', 44, signY + 16);

        doc.text('CLIENT REPRESENTATIVE', 380, signY + 6)
            .text(dpr.client_name || 'LUMINA', 380, signY + 16);

        doc.end();
    }

    /**
     * Generate official Excel export matching the exact format shared by client
     */
    async generateDprExcel(dpr, res) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'NKD Power Solutions CRM';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Daily Progress Report', {
            views: [{ showGridLines: true }]
        });

        sheet.columns = [
            { key: 'A', width: 8 },
            { key: 'B', width: 34 },
            { key: 'C', width: 18 },
            { key: 'D', width: 18 },
            { key: 'E', width: 16 },
            { key: 'F', width: 8 },
            { key: 'G', width: 38 },
            { key: 'H', width: 22 }
        ];

        // Row 1: Header
        sheet.mergeCells('A1:H1');
        const titleRow = sheet.getCell('A1');
        titleRow.value = `Daily Site Progress Report - ${dpr.site_name || 'PROJECT SITE'}, MUMBAI - ${dpr.contractor_name || 'NKD POWER SOLUTIONS PVT LTD'} - Date: ${formatDisplayDate(dpr.report_date)}`;
        titleRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 28;

        // Row 2: Report Number
        sheet.mergeCells('B2:E2');
        sheet.getCell('A2').value = 'Report No:';
        sheet.getCell('A2').font = { bold: true };
        sheet.getCell('B2').value = dpr.report_no || '-';
        sheet.getCell('B2').font = { bold: true, color: { argb: 'FF0284C7' } };
        sheet.getRow(2).height = 20;

        // Rows 3-6: Project Details Grid
        const details = [
            { l1: 'End Client Name:', v1: dpr.client_name || '-', l2: 'PO Value in INR Cr.:', v2: dpr.po_value ? Number(dpr.po_value) : 0, isCur: true },
            { l1: 'PO No. | Date:', v1: dpr.po_number || '-', l2: 'Current Billing Value in INR Cr.:', v2: dpr.current_billing_value ? Number(dpr.current_billing_value) : 0, isCur: true },
            { l1: 'Start Date:', v1: formatDisplayDate(dpr.start_date), l2: 'Billing Progress:', v2: `${dpr.billing_progress_pct || 0}%`, isPct: true },
            { l1: 'Completion Date:', v1: formatDisplayDate(dpr.completion_date), l2: 'Total Manpower On Site:', v2: dpr.manpower_total || 0 }
        ];

        let rIdx = 3;
        details.forEach(d => {
            sheet.getCell(`A${rIdx}`).value = d.l1;
            sheet.getCell(`A${rIdx}`).font = { bold: true, size: 9 };
            sheet.getCell(`B${rIdx}`).value = d.v1;
            sheet.getCell(`B${rIdx}`).font = { size: 9 };
            sheet.mergeCells(`B${rIdx}:D${rIdx}`);

            sheet.getCell(`E${rIdx}`).value = d.l2;
            sheet.getCell(`E${rIdx}`).font = { bold: true, size: 9 };
            sheet.getCell(`F${rIdx}`).value = d.v2;
            sheet.getCell(`F${rIdx}`).font = { bold: true, size: 9 };
            if (d.isCur) sheet.getCell(`F${rIdx}`).numFmt = '₹#,##0.00';
            sheet.mergeCells(`F${rIdx}:H${rIdx}`);

            sheet.getRow(rIdx).height = 18;
            rIdx++;
        });

        rIdx++;

        // Activity Section Header
        sheet.mergeCells(`A${rIdx}:E${rIdx}`);
        const actLeft = sheet.getCell(`A${rIdx}`);
        actLeft.value = 'Today Activity Status';
        actLeft.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        actLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        actLeft.alignment = { horizontal: 'center' };

        sheet.mergeCells(`F${rIdx}:H${rIdx}`);
        const actRight = sheet.getCell(`F${rIdx}`);
        actRight.value = 'Activity Planned for Next Day';
        actRight.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        actRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        actRight.alignment = { horizontal: 'center' };
        sheet.getRow(rIdx).height = 22;
        rIdx++;

        // Activity Columns Sub-header
        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.getCell(`B${rIdx}`).value = 'Planned Work Description';
        sheet.getCell(`C${rIdx}`).value = 'Completion Status';
        sheet.getCell(`D${rIdx}`).value = 'Dependencies Responsible';
        sheet.getCell(`E${rIdx}`).value = 'Photo Reference';
        sheet.getCell(`F${rIdx}`).value = 'S. No.';
        sheet.mergeCells(`G${rIdx}:H${rIdx}`);
        sheet.getCell(`G${rIdx}`).value = 'Planned in this & next week (including carry forward if any)';

        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
            const c = sheet.getCell(`${col}${rIdx}`);
            c.font = { bold: true, size: 8.5 };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        sheet.getRow(rIdx).height = 24;
        rIdx++;

        const todayActs = Array.isArray(dpr.today_activities) ? dpr.today_activities : [];
        const nextActs = Array.isArray(dpr.next_day_activities) ? dpr.next_day_activities : [];
        const maxActs = Math.max(todayActs.length, nextActs.length, 5);

        for (let i = 0; i < maxActs; i++) {
            const t = todayActs[i];
            const n = nextActs[i];

            sheet.getCell(`A${rIdx}`).value = i + 1;
            sheet.getCell(`B${rIdx}`).value = t ? (t.description || '') : '';
            sheet.getCell(`C${rIdx}`).value = t ? (t.status || 'In Progress') : '';
            sheet.getCell(`D${rIdx}`).value = t ? (t.dependencies || 'NKD') : '';
            sheet.getCell(`E${rIdx}`).value = t ? (t.photo_ref || (t.photo_id ? `Photo ${t.photo_id}` : '')) : '';

            sheet.getCell(`F${rIdx}`).value = i + 1;
            sheet.mergeCells(`G${rIdx}:H${rIdx}`);
            sheet.getCell(`G${rIdx}`).value = n ? (n.description || '') : '';

            sheet.getRow(rIdx).height = 20;
            rIdx++;
        }

        rIdx++;

        // Show Stoppers Section
        sheet.mergeCells(`A${rIdx}:H${rIdx}`);
        const stopHeader = sheet.getCell(`A${rIdx}`);
        stopHeader.value = 'Show Stoppers / Concern Areas (since nos. of weeks)';
        stopHeader.font = { bold: true, color: { argb: 'FF991B1B' } };
        stopHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        sheet.getRow(rIdx).height = 20;
        rIdx++;

        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.mergeCells(`B${rIdx}:E${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'Concern Areas / Blockers';
        sheet.mergeCells(`F${rIdx}:H${rIdx}`);
        sheet.getCell(`F${rIdx}`).value = '1st Intimation Date';
        ['A', 'B', 'F'].forEach(c => {
            sheet.getCell(`${c}${rIdx}`).font = { bold: true, size: 8.5 };
            sheet.getCell(`${c}${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
        sheet.getRow(rIdx).height = 18;
        rIdx++;

        const stoppers = Array.isArray(dpr.show_stoppers) ? dpr.show_stoppers : [];
        if (stoppers.length === 0) {
            sheet.getCell(`A${rIdx}`).value = '-';
            sheet.mergeCells(`B${rIdx}:E${rIdx}`);
            sheet.getCell(`B${rIdx}`).value = 'No critical show stoppers reported.';
            sheet.mergeCells(`F${rIdx}:H${rIdx}`);
            sheet.getCell(`F${rIdx}`).value = '-';
            rIdx++;
        } else {
            stoppers.forEach((st, idx) => {
                sheet.getCell(`A${rIdx}`).value = idx + 1;
                sheet.mergeCells(`B${rIdx}:E${rIdx}`);
                sheet.getCell(`B${rIdx}`).value = st.concern_area || '';
                sheet.mergeCells(`F${rIdx}:H${rIdx}`);
                sheet.getCell(`F${rIdx}`).value = formatDisplayDate(st.intimation_date);
                rIdx++;
            });
        }

        rIdx++;

        // Manpower Deployment Section
        sheet.mergeCells(`A${rIdx}:H${rIdx}`);
        const mpHeader = sheet.getCell(`A${rIdx}`);
        mpHeader.value = 'Daily Progress for Manpower (Type & Count)';
        mpHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        mpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(rIdx).height = 20;
        rIdx++;

        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.mergeCells(`B${rIdx}:D${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'Trade / Designation';
        sheet.mergeCells(`E${rIdx}:F${rIdx}`);
        sheet.getCell(`E${rIdx}`).value = 'Required';
        sheet.mergeCells(`G${rIdx}:H${rIdx}`);
        sheet.getCell(`G${rIdx}`).value = 'Available On Site';

        ['A', 'B', 'E', 'G'].forEach(c => {
            sheet.getCell(`${c}${rIdx}`).font = { bold: true, size: 8.5 };
            sheet.getCell(`${c}${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
        rIdx++;

        const manpower = Array.isArray(dpr.manpower_data) && dpr.manpower_data.length > 0 ? dpr.manpower_data : [
            { trade: 'EHS Officer', required: 1, available: 1 },
            { trade: 'Electrician', required: 2, available: 0 },
            { trade: 'Engineer', required: 1, available: 0 },
            { trade: 'Fitter', required: 1, available: 0 },
            { trade: 'Welder', required: 1, available: 0 },
            { trade: 'Helper', required: 7, available: 7 },
            { trade: 'Supervisor', required: 1, available: 0 },
            { trade: 'Testing Engineer', required: 1, available: 0 },
            { trade: 'Cable Jointer', required: 2, available: 0 },
            { trade: 'Scaffolding Team', required: 4, available: 0 },
            { trade: 'Site Manager', required: 1, available: 1 }
        ];

        let totReq = 0;
        let totAvail = 0;
        manpower.forEach((mp, idx) => {
            const req = parseInt(mp.required || 0, 10) || 0;
            const avail = parseInt(mp.available || 0, 10) || 0;
            totReq += req;
            totAvail += avail;

            sheet.getCell(`A${rIdx}`).value = idx + 1;
            sheet.mergeCells(`B${rIdx}:D${rIdx}`);
            sheet.getCell(`B${rIdx}`).value = mp.trade || '';
            sheet.mergeCells(`E${rIdx}:F${rIdx}`);
            sheet.getCell(`E${rIdx}`).value = req;
            sheet.mergeCells(`G${rIdx}:H${rIdx}`);
            sheet.getCell(`G${rIdx}`).value = avail;
            rIdx++;
        });

        // Manpower Total Row
        sheet.getCell(`A${rIdx}`).value = '';
        sheet.mergeCells(`B${rIdx}:D${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'TOTAL MANPOWER ENGAGED';
        sheet.getCell(`B${rIdx}`).font = { bold: true };
        sheet.mergeCells(`E${rIdx}:F${rIdx}`);
        sheet.getCell(`E${rIdx}`).value = totReq;
        sheet.getCell(`E${rIdx}`).font = { bold: true };
        sheet.mergeCells(`G${rIdx}:H${rIdx}`);
        sheet.getCell(`G${rIdx}`).value = totAvail;
        sheet.getCell(`G${rIdx}`).font = { bold: true, color: { argb: 'FF0284C7' } };
        sheet.getRow(rIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        rIdx++;

        rIdx++;

        // Photos Log Section
        const photosList = Array.isArray(dpr.photos) ? dpr.photos : [];
        if (photosList.length > 0) {
            sheet.mergeCells(`A${rIdx}:H${rIdx}`);
            const pHeader = sheet.getCell(`A${rIdx}`);
            pHeader.value = 'Site Progress Photos & Visual Evidence Log';
            pHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            pHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            rIdx++;

            sheet.getCell(`A${rIdx}`).value = 'S. No.';
            sheet.getCell(`B${rIdx}`).value = 'Photo Reference';
            sheet.mergeCells(`C${rIdx}:E${rIdx}`);
            sheet.getCell(`C${rIdx}`).value = 'Caption & Area Details';
            sheet.mergeCells(`F${rIdx}:H${rIdx}`);
            sheet.getCell(`F${rIdx}`).value = 'File Name / Status';
            ['A', 'B', 'C', 'F'].forEach(c => {
                sheet.getCell(`${c}${rIdx}`).font = { bold: true, size: 8.5 };
                sheet.getCell(`${c}${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            });
            rIdx++;

            photosList.forEach((p, idx) => {
                sheet.getCell(`A${rIdx}`).value = idx + 1;
                sheet.getCell(`B${rIdx}`).value = p.photo_ref || `Photo ${idx + 1}`;
                sheet.getCell(`B${rIdx}`).font = { bold: true, color: { argb: 'FF0284C7' } };
                sheet.mergeCells(`C${rIdx}:E${rIdx}`);
                sheet.getCell(`C${rIdx}`).value = p.caption || '';
                sheet.mergeCells(`F${rIdx}:H${rIdx}`);
                sheet.getCell(`F${rIdx}`).value = p.url ? path.basename(p.url) : 'Verified on Site';
                rIdx++;
            });
        }

        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        // Include Custom Interactive Excel Grid / Sheet if present
        if (dpr.excel_grid && Array.isArray(dpr.excel_grid.columns) && dpr.excel_grid.columns.length > 0) {
            const gridCols = dpr.excel_grid.columns;
            const gridRows = Array.isArray(dpr.excel_grid.rows) ? dpr.excel_grid.rows : [];
            const customSheet = workbook.addWorksheet('Custom Site Sheet', {
                views: [{ showGridLines: true }]
            });

            customSheet.mergeCells(1, 1, 1, Math.max(gridCols.length, 1));
            const banner = customSheet.getCell(1, 1);
            banner.value = `Site Work Breakdown & Custom Table • ${dpr.report_no || 'DPR'} (${formatDate(dpr.report_date)})`;
            banner.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            banner.alignment = { horizontal: 'center', vertical: 'middle' };
            customSheet.getRow(1).height = 28;

            const cHeaderRow = customSheet.getRow(2);
            cHeaderRow.height = 24;
            gridCols.forEach((col, cIdx) => {
                const cell = cHeaderRow.getCell(cIdx + 1);
                cell.value = col.title || `Column ${cIdx + 1}`;
                cell.font = { bold: true, size: 9.5, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                customSheet.getColumn(cIdx + 1).width = Math.max(14, Math.round((col.width || 120) / 7.5));
            });

            gridRows.forEach((rData, rNum) => {
                const row = customSheet.getRow(rNum + 3);
                row.height = 20;
                gridCols.forEach((col, cIdx) => {
                    const cell = row.getCell(cIdx + 1);
                    cell.value = rData[col.key] ?? '';
                    cell.font = { size: 9 };
                    cell.alignment = { vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                    if (rNum % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }
                });
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="DPR-${String(dpr.report_no || dpr.dpr_id).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Get or set Site Google Sheet & Live Excel Grid
     */
    async getSiteSheet(siteId) {
        await this.ensureDprTable();
        const id = cleanInt(siteId);
        if (!id) return null;
        const res = await pool.query(
            'SELECT site_id, site_code, site_name, principal_employer_name, google_sheet_url, excel_grid FROM sites WHERE site_id = $1',
            [id]
        );
        if (res.rows.length === 0) return null;
        return res.rows[0];
    }

    async saveSiteSheet(siteId, { google_sheet_url, excel_grid }) {
        await this.ensureDprTable();
        const id = cleanInt(siteId);
        if (!id) throw new Error('Invalid site ID');

        const fields = [];
        const params = [];
        let pIdx = 1;

        if (google_sheet_url !== undefined) {
            fields.push(`google_sheet_url = $${pIdx++}`);
            params.push(google_sheet_url ? String(google_sheet_url).trim() : null);
        }
        if (excel_grid !== undefined) {
            fields.push(`excel_grid = $${pIdx++}`);
            params.push(excel_grid && typeof excel_grid === 'object' ? JSON.stringify(excel_grid) : null);
        }

        if (fields.length === 0) return this.getSiteSheet(id);

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        const sql = `UPDATE sites SET ${fields.join(', ')} WHERE site_id = $${pIdx} RETURNING site_id, site_code, site_name, google_sheet_url, excel_grid`;
        const res = await pool.query(sql, params);
        return res.rows[0];
    }
}

module.exports = new DprService();
