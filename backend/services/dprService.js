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
     * Delete DPR (Archives to Recycle Bin for 1-Click Restore)
     */
    async deleteDpr(id, user = null, req = null) {
        await this.ensureDprTable();
        const dprRes = await pool.query('SELECT * FROM daily_progress_reports WHERE dpr_id = $1', [cleanInt(id)]);
        if (dprRes.rows.length === 0) {
            const err = new Error('DPR record not found');
            err.status = 404;
            throw err;
        }
        const dpr = dprRes.rows[0];

        // Archive into Recycle Bin & Audit Trail
        const recycleBinService = require('./recycleBinService');
        await recycleBinService.moveToBin({
            module: 'DPR',
            recordId: id,
            recordTitle: `DPR Report: ${dpr.report_no || id} (${dpr.report_date ? String(dpr.report_date).slice(0, 10) : ''})`,
            recordData: dpr,
            user,
            req
        }).catch((err) => console.error('DPR recycle bin archive error:', err));

        await pool.query('DELETE FROM daily_progress_reports WHERE dpr_id = $1', [cleanInt(id)]);
        return { success: true, message: 'DPR moved to Recycle Bin' };
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
    /**
     * Generate official printable PDF for DPR matching the exact GTPL / LUMINA reference sheet
     */
    async generateDprPdf(dpr, res) {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="DPR-${String(dpr.report_no || dpr.dpr_id).replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
        doc.pipe(res);

        const W = 801.89; // total usable width across 841.89
        const leftW = 430;
        const rightW = W - leftW; // 371.89

        const drawCell = (x, y, w, h, text, options = {}) => {
            const {
                bold = false,
                size = 8,
                align = 'left',
                valign = 'middle',
                fill = null,
                textColor = '#000000',
                stroke = '#000000',
                lineWidth = 0.5,
                padX = 4,
                padY = 2
            } = options;

            if (fill) {
                doc.rect(x, y, w, h).fill(fill);
            }
            if (stroke) {
                doc.lineWidth(lineWidth).rect(x, y, w, h).stroke(stroke);
            }

            if (text !== undefined && text !== null && String(text).trim() !== '') {
                doc.fillColor(textColor).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
                const str = String(text);
                const textY = valign === 'middle' ? y + (h - size) / 2 - 1 : y + padY;
                doc.text(str, x + padX, textY, {
                    width: w - padX * 2,
                    height: h - padY * 2,
                    align: align,
                    ellipsis: true,
                    lineBreak: false
                });
            }
        };

        const tryEmbedImage = (photoUrl, x, y, maxW, maxH) => {
            if (!photoUrl) return false;
            const candidates = [
                path.resolve(__dirname, '..', photoUrl.replace(/^\//, '')),
                path.resolve(__dirname, '../../', photoUrl.replace(/^\//, '')),
                path.resolve(__dirname, '../../uploads', path.basename(photoUrl)),
                path.resolve(__dirname, '../uploads', path.basename(photoUrl)),
                path.resolve(process.cwd(), photoUrl.replace(/^\//, '')),
                path.resolve(process.cwd(), 'backend', photoUrl.replace(/^\//, '')),
                path.resolve(process.cwd(), 'backend', 'uploads', path.basename(photoUrl)),
                path.resolve(process.cwd(), 'backend', 'public', photoUrl.replace(/^\//, ''))
            ];
            for (const cand of candidates) {
                try {
                    if (fs.existsSync(cand) && !cand.endsWith('.svg')) {
                        doc.image(cand, x, y, {
                            fit: [maxW, maxH],
                            align: 'center',
                            valign: 'center'
                        });
                        return true;
                    }
                } catch (_) {}
            }
            return false;
        };

        // ==========================================
        // PAGE 1: Master Info, Activities & Showstoppers
        // ==========================================
        let curY = 20;

        // 1. Title Banner (Matching Client Reference)
        const siteTitle = dpr.site_name || 'GTPL LUMINA';
        const locTitle = dpr.city || dpr.location || 'AIROLI , MUMBAI';
        const contractorTitle = dpr.contractor_name || 'NKD POWER SOLUTIONS PVT LTD';
        const reportDateTitle = formatDisplayDate(dpr.report_date || getIstToday());
        const titleText = `Daily Site Progress Report - ${siteTitle}, ${locTitle} - ${contractorTitle} - Date: ${reportDateTitle}`;
        drawCell(20, curY, W, 22, titleText, { bold: true, size: 9.5, align: 'center', fill: '#f8fafc' });
        curY += 22;

        // 2. Project Metadata Grid (5 rows matching client excel sheet)
        const metaRowH = 13.5;
        const formattedPoVal = dpr.po_value ? Number(dpr.po_value).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '48,374,200.00';
        const formattedBillingVal = dpr.current_billing_value && Number(dpr.current_billing_value) > 0
            ? Number(dpr.current_billing_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })
            : '  -   ';

        const metaRows = [
            {
                l1: 'Report No', v1: dpr.report_no || 'GTPL LUMINA/124',
                l2: 'PO Value in INR Cr.:', v2: formattedPoVal, alignRight: true
            },
            {
                l1: 'End Client Name:', v1: dpr.client_name || 'LUMINA',
                l2: 'Current Billing Value in INR Cr.:', v2: formattedBillingVal, alignRight: true
            },
            {
                l1: 'PO No. | Date:', v1: dpr.po_number || '600190',
                l2: 'Billing Progress:', v2: `${dpr.billing_progress_pct || 0}%`, alignRight: true
            },
            {
                l1: 'Start Date:', v1: formatDisplayDate(dpr.start_date) || '16-Apr-26',
                l2: "Week's Manpower Rate:", v2: dpr.weeks_manpower_rate || '', alignRight: false
            },
            {
                l1: 'Completion Date:', v1: formatDisplayDate(dpr.completion_date) || '24-Jul-26',
                l2: '', v2: '', alignRight: false
            }
        ];

        metaRows.forEach((row) => {
            // Left Block: Label (110pt) | Value (320pt)
            drawCell(20, curY, 110, metaRowH, row.l1, { bold: true, size: 7.5 });
            drawCell(130, curY, 320, metaRowH, row.v1, { size: 7.5, bold: row.l1 === 'Report No' });

            // Right Block: Label (180pt) | Value (191.89pt)
            drawCell(450, curY, 180, metaRowH, row.l2, { bold: true, size: 7.5 });
            drawCell(630, curY, rightW - 180, metaRowH, row.v2, { size: 7.5, align: row.alignRight ? 'right' : 'left' });
            curY += metaRowH;
        });

        curY += 6;

        // 3. Activity Section Header Bar (Peach Left, Sky Blue Right)
        drawCell(20, curY, leftW, 18, 'Today Activity Status', { bold: true, size: 8.5, align: 'center', fill: '#fce5cd' });
        drawCell(450, curY, rightW, 18, 'Activity Planned for Next Day', { bold: true, size: 8.5, align: 'center', fill: '#d9e1f2' });
        curY += 18;

        // Subheaders
        const subH = 22;
        // Left: S. No. (26) | Planned (224) | Status (60) | Responsible (48) | Photo Ref (72)
        drawCell(20, curY, 26, subH, 'S. No.', { bold: true, size: 7, align: 'center' });
        drawCell(46, curY, 224, subH, 'Planned', { bold: true, size: 7, align: 'center' });
        drawCell(270, curY, 60, subH, 'Completion Status', { bold: true, size: 6.5, align: 'center' });
        drawCell(330, curY, 48, subH, 'Dependencies Responsible', { bold: true, size: 6.5, align: 'center' });
        drawCell(378, curY, 72, subH, 'Photo Reference', { bold: true, size: 6.5, align: 'center' });

        // Right: S. No. (26) | Planned in this & next week (345.89)
        drawCell(450, curY, 26, subH, 'S. No.', { bold: true, size: 7, align: 'center' });
        drawCell(476, curY, rightW - 26, subH, 'Planned in this & next week (including carry forward if any)', { bold: true, size: 7, align: 'center' });
        curY += subH;

        // Exact 13 Rows of Activities (Matching Client Reference)
        const actRowH = 14.5;
        const todayActs = Array.isArray(dpr.today_activities) ? dpr.today_activities : [];
        const nextActs = Array.isArray(dpr.next_day_activities) ? dpr.next_day_activities : [];

        for (let i = 1; i <= 13; i++) {
            const t = todayActs[i - 1];
            const n = nextActs[i - 1];

            // Left cols
            drawCell(20, curY, 26, actRowH, String(i), { size: 7, align: 'center' });
            drawCell(46, curY, 224, actRowH, t?.description || '', { size: 7 });
            drawCell(270, curY, 60, actRowH, t?.status || '', { size: 6.5, align: 'center' });
            drawCell(330, curY, 48, actRowH, t?.dependencies || '', { size: 6.5, align: 'center' });
            drawCell(378, curY, 72, actRowH, t?.photo_ref || '', { size: 6.5, align: 'center' });

            // Right cols
            drawCell(450, curY, 26, actRowH, String(i), { size: 7, align: 'center' });
            drawCell(476, curY, rightW - 26, actRowH, n?.description || '', { size: 7 });

            curY += actRowH;
        }

        curY += 6;

        // 4. Show Stoppers Section
        drawCell(20, curY, leftW, 16, '', { fill: '#ffffff', stroke: false });
        drawCell(450, curY, rightW, 16, 'Show Stoppers (since nos. of weeks)', { bold: true, size: 8, align: 'center', fill: '#d9e1f2' });
        curY += 16;

        // Show Stoppers Subheaders
        const stopSubH = 16;
        drawCell(20, curY, 26, stopSubH, 'S. No.', { bold: true, size: 7, align: 'center' });
        drawCell(46, curY, 274, stopSubH, 'Concern Areas', { bold: true, size: 7, align: 'center' });
        drawCell(320, curY, 130, stopSubH, '1st Intimation Date', { bold: true, size: 7, align: 'center' });

        drawCell(450, curY, 26, stopSubH, 'S. No.', { bold: true, size: 7, align: 'center' });
        drawCell(476, curY, rightW - 26, stopSubH, 'Concern Areas', { bold: true, size: 7, align: 'center' });
        curY += stopSubH;

        const stopRowH = 13.5;
        const stoppers = Array.isArray(dpr.show_stoppers) ? dpr.show_stoppers : [];

        for (let i = 1; i <= 9; i++) {
            const sLeft = stoppers[i - 1];
            drawCell(20, curY, 26, stopRowH, String(i), { size: 7, align: 'center' });
            drawCell(46, curY, 274, stopRowH, sLeft?.concern_area || '', { size: 7 });
            drawCell(320, curY, 130, stopRowH, sLeft?.intimation_date ? formatDisplayDate(sLeft.intimation_date) : '', { size: 7, align: 'center' });

            drawCell(450, curY, 26, stopRowH, String(i), { size: 7, align: 'center' });
            drawCell(476, curY, rightW - 26, stopRowH, '', { size: 7 });

            curY += stopRowH;
        }

        // Row 10 on right side
        drawCell(450, curY, 26, stopRowH, '10', { size: 7, align: 'center' });
        drawCell(476, curY, rightW - 26, stopRowH, '', { size: 7 });

        // Page 1 Footer
        doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
            .text('NKD POWER SOLUTIONS PVT LTD • Daily Site Progress Report • Form GTPL-LUMINA-DPR-01', 20, 572);
        doc.text('Page 1 of 2', 740, 572, { align: 'right', width: 80 });

        // ==========================================
        // PAGE 2: Manpower Table & Photo Grid (1 to 7)
        // ==========================================
        doc.addPage();
        curY = 20;

        // Page 2 Header Banner
        drawCell(20, curY, W, 20, `Daily Site Progress Report - ${siteTitle} - Manpower Deployment & Site Photo Evidence`, {
            bold: true, size: 9, align: 'center', fill: '#f8fafc'
        });
        curY += 24;

        // Manpower Table on Left (Width: 430pt)
        const mpHeaderY = curY;
        const mpSubH = 16;
        drawCell(20, curY, 26, mpSubH, 'S. No.', { bold: true, size: 7, align: 'center' });
        drawCell(46, curY, 254, mpSubH, 'Daily Progress for Manpower (Type & Count)', { bold: true, size: 7.5 });
        drawCell(300, curY, 65, mpSubH, 'Required', { bold: true, size: 7.5, align: 'center' });
        drawCell(365, curY, 85, mpSubH, 'Available', { bold: true, size: 7.5, align: 'center' });
        curY += mpSubH;

        const defaultTrades = [
            { trade: 'EHS Officer', defaultAvail: 1 },
            { trade: 'Electrician', defaultAvail: 0 },
            { trade: 'Engineer', defaultAvail: 0 },
            { trade: 'Fitter', defaultAvail: 0 },
            { trade: 'Welder', defaultAvail: 0 },
            { trade: 'Helper', defaultAvail: 7 },
            { trade: 'supervisor', defaultAvail: 0 },
            { trade: 'Testing engineer', defaultAvail: 0 },
            { trade: 'Cable jointer', defaultAvail: 0 },
            { trade: 'Scaffolding erection team', defaultAvail: 0 },
            { trade: 'Site Manager', defaultAvail: 1 }
        ];

        const mpRowH = 14;
        let totalAvail = 0;
        let totalReq = 0;

        defaultTrades.forEach((item, idx) => {
            const match = (dpr.manpower_data || []).find(m => m.trade?.toLowerCase() === item.trade.toLowerCase()) || {};
            const req = match.required !== undefined && match.required !== '' ? match.required : '';
            const avail = match.available !== undefined && match.available !== '' ? Number(match.available) : item.defaultAvail;
            totalAvail += (Number(avail) || 0);
            if (Number(req)) totalReq += Number(req);

            drawCell(20, curY, 26, mpRowH, String(idx + 1), { size: 7, align: 'center' });
            drawCell(46, curY, 254, mpRowH, item.trade, { size: 7.5 });
            drawCell(300, curY, 65, mpRowH, String(req), { size: 7.5, align: 'center' });
            drawCell(365, curY, 85, mpRowH, String(avail), { size: 7.5, align: 'center' });
            curY += mpRowH;
        });

        // Total Row (Available cell has bright yellow background #ffff00!)
        const totalRowH = 16;
        drawCell(20, curY, 26, totalRowH, '', {});
        drawCell(46, curY, 254, totalRowH, 'Total', { bold: true, size: 8, align: 'right', padX: 10 });
        drawCell(300, curY, 65, totalRowH, totalReq > 0 ? String(totalReq) : '', { bold: true, size: 8, align: 'center' });
        drawCell(365, curY, 85, totalRowH, String(totalAvail), {
            bold: true,
            size: 8.5,
            align: 'center',
            fill: '#ffff00', // EXACT BRIGHT YELLOW CELL FROM REFERENCE SCREENSHOT!
            textColor: '#000000'
        });
        curY += totalRowH;

        // Beside Manpower Table on Right: PHOTO : 1
        const photo1X = 460;
        const photo1W = W - (photo1X - 20); // 361.89 pt
        const photo1H = curY - mpHeaderY; // exact height matching manpower table!

        // Draw Photo 1 Box
        doc.lineWidth(0.5).rect(photo1X, mpHeaderY, photo1W, photo1H).stroke('#000000');
        const photo1Obj = (dpr.photos || [])[0];
        let p1Drawn = false;
        if (photo1Obj && photo1Obj.url) {
            p1Drawn = tryEmbedImage(photo1Obj.url, photo1X + 4, mpHeaderY + 4, photo1W - 8, photo1H - 32);
        }

        if (!p1Drawn) {
            doc.fillColor('#94a3b8').font('Helvetica').fontSize(14)
                .text('#REF!', photo1X, mpHeaderY + (photo1H / 2) - 10, { width: photo1W, align: 'center' });
        }

        // Photo 1 Tag at bottom left corner
        doc.lineWidth(1).rect(photo1X + 8, mpHeaderY + photo1H - 24, 65, 16).stroke('#16a34a');
        doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(7.5)
            .text('PHOTO : 1', photo1X + 10, mpHeaderY + photo1H - 20, { width: 61, align: 'center' });

        curY += 14;

        // Photos 2 to 7 Grid (2 rows of 3 photos each)
        const pGridRowH = 138;
        const colPad = 12;
        const pBoxW = (W - colPad * 2) / 3; // 258 pt each

        // Row 1: Photo 2 | Photo 3 | Photo 4
        const row1Photos = [
            { idx: 1, label: 'Photo 2', tag: 'PHOTO:2', x: 20 },
            { idx: 2, label: 'Photo 3', tag: 'PHOTO:3', x: 20 + pBoxW + colPad },
            { idx: 3, label: 'Photo 4', tag: 'PHOTO:4', x: 20 + (pBoxW + colPad) * 2 }
        ];

        row1Photos.forEach((p) => {
            doc.lineWidth(0.5).rect(p.x, curY, pBoxW, pGridRowH).stroke('#000000');
            const pObj = (dpr.photos || [])[p.idx];
            let drawn = false;
            if (pObj && pObj.url) {
                drawn = tryEmbedImage(pObj.url, p.x + 4, curY + 4, pBoxW - 8, pGridRowH - 30);
            }
            if (!drawn) {
                doc.fillColor('#334155').font('Helvetica').fontSize(9)
                    .text(p.label, p.x, curY + (pGridRowH / 2) - 10, { width: pBoxW, align: 'center' });
            }
            // Tag at bottom left
            doc.lineWidth(0.8).rect(p.x + 8, curY + pGridRowH - 22, 58, 14).stroke('#2563eb');
            doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(7)
                .text(p.tag, p.x + 10, curY + pGridRowH - 19, { width: 54, align: 'center' });
        });

        curY += pGridRowH + 12;

        // Row 2: Photo 5 | Photo 6 | Photo 7
        const row2Photos = [
            { idx: 4, label: 'Photo 5', tag: 'PHOTO:5', x: 20 },
            { idx: 5, label: 'Photo 6', tag: 'PHOTO:6', x: 20 + pBoxW + colPad },
            { idx: 6, label: 'Photo 7', tag: 'PHOTO:7', x: 20 + (pBoxW + colPad) * 2 }
        ];

        row2Photos.forEach((p) => {
            doc.lineWidth(0.5).rect(p.x, curY, pBoxW, pGridRowH).stroke('#000000');
            const pObj = (dpr.photos || [])[p.idx];
            let drawn = false;
            if (pObj && pObj.url) {
                drawn = tryEmbedImage(pObj.url, p.x + 4, curY + 4, pBoxW - 8, pGridRowH - 30);
            }
            if (!drawn) {
                doc.fillColor('#334155').font('Helvetica').fontSize(9)
                    .text(p.label, p.x, curY + (pGridRowH / 2) - 10, { width: pBoxW, align: 'center' });
            }
            // Tag at bottom left
            doc.lineWidth(0.8).rect(p.x + 8, curY + pGridRowH - 22, 58, 14).stroke('#2563eb');
            doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(7)
                .text(p.tag, p.x + 10, curY + pGridRowH - 19, { width: 54, align: 'center' });
        });

        // Page 2 Footer
        doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
            .text('NKD POWER SOLUTIONS PVT LTD • Site Evidence Photo Register', 20, 572);
        doc.text('Page 2 of 2', 740, 572, { align: 'right', width: 80 });

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
            { key: 'A', width: 6 },
            { key: 'B', width: 44 },
            { key: 'C', width: 18 },
            { key: 'D', width: 16 },
            { key: 'E', width: 16 },
            { key: 'F', width: 6 },
            { key: 'G', width: 50 }
        ];

        // Row 1: Header
        sheet.mergeCells('A1:G1');
        const titleRow = sheet.getCell('A1');
        titleRow.value = `Daily Site Progress Report - ${dpr.site_name || 'GTPL LUMINA'}, ${dpr.city || 'AIROLI , MUMBAI'} - ${dpr.contractor_name || 'NKD POWER SOLUTIONS PVT LTD'} - Date: ${formatDisplayDate(dpr.report_date)}`;
        titleRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(1).height = 26;

        // Rows 2-6: Project Details Grid
        const metaList = [
            { l1: 'Report No', v1: dpr.report_no || 'GTPL LUMINA/124', l2: 'PO Value in INR Cr.:', v2: dpr.po_value ? Number(dpr.po_value) : 48374200, isNum: true },
            { l1: 'End Client Name:', v1: dpr.client_name || 'LUMINA', l2: 'Current Billing Value in INR Cr.:', v2: dpr.current_billing_value ? Number(dpr.current_billing_value) : '-', isNum: false },
            { l1: 'PO No. | Date:', v1: dpr.po_number || '600190', l2: 'Billing Progress:', v2: `${dpr.billing_progress_pct || 0}%`, isNum: false },
            { l1: 'Start Date:', v1: formatDisplayDate(dpr.start_date) || '16-Apr-26', l2: "Week's Manpower Rate:", v2: dpr.weeks_manpower_rate || '', isNum: false },
            { l1: 'Completion Date:', v1: formatDisplayDate(dpr.completion_date) || '24-Jul-26', l2: '', v2: '', isNum: false }
        ];

        let rIdx = 2;
        metaList.forEach((m) => {
            sheet.getCell(`A${rIdx}`).value = m.l1;
            sheet.getCell(`A${rIdx}`).font = { bold: true, size: 9 };
            sheet.getCell(`B${rIdx}`).value = m.v1;
            sheet.getCell(`B${rIdx}`).font = { size: 9 };
            sheet.mergeCells(`B${rIdx}:E${rIdx}`);

            sheet.getCell(`F${rIdx}`).value = m.l2;
            sheet.getCell(`F${rIdx}`).font = { bold: true, size: 9 };
            sheet.getCell(`G${rIdx}`).value = m.v2;
            sheet.getCell(`G${rIdx}`).font = { size: 9 };
            if (m.isNum && typeof m.v2 === 'number') {
                sheet.getCell(`G${rIdx}`).numFmt = '#,##0.00';
            }
            sheet.getRow(rIdx).height = 18;
            rIdx++;
        });

        // Row 7: Section Headers
        sheet.mergeCells(`A${rIdx}:E${rIdx}`);
        const actLeft = sheet.getCell(`A${rIdx}`);
        actLeft.value = 'Today Activity Status';
        actLeft.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
        actLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }; // Peach fill
        actLeft.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(`F${rIdx}:G${rIdx}`);
        const actRight = sheet.getCell(`F${rIdx}`);
        actRight.value = 'Activity Planned for Next Day';
        actRight.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
        actRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; // Pale blue fill
        actRight.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(rIdx).height = 22;
        rIdx++;

        // Row 8: Subheaders
        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.getCell(`B${rIdx}`).value = 'Planned';
        sheet.getCell(`C${rIdx}`).value = 'Completion Status';
        sheet.getCell(`D${rIdx}`).value = 'Dependencies Responsible';
        sheet.getCell(`E${rIdx}`).value = 'Photo Reference';
        sheet.getCell(`F${rIdx}`).value = 'S. No.';
        sheet.getCell(`G${rIdx}`).value = 'Planned in this & next week (including carry forward if any)';

        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((c) => {
            const cell = sheet.getCell(`${c}${rIdx}`);
            cell.font = { bold: true, size: 8.5 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        sheet.getRow(rIdx).height = 24;
        rIdx++;

        // 13 Activity Rows
        const todayActs = Array.isArray(dpr.today_activities) ? dpr.today_activities : [];
        const nextActs = Array.isArray(dpr.next_day_activities) ? dpr.next_day_activities : [];

        for (let i = 1; i <= 13; i++) {
            const t = todayActs[i - 1];
            const n = nextActs[i - 1];

            sheet.getCell(`A${rIdx}`).value = i;
            sheet.getCell(`A${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`B${rIdx}`).value = t ? (t.description || '') : '';
            sheet.getCell(`C${rIdx}`).value = t ? (t.status || '') : '';
            sheet.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`D${rIdx}`).value = t ? (t.dependencies || '') : '';
            sheet.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`E${rIdx}`).value = t ? (t.photo_ref || '') : '';
            sheet.getCell(`E${rIdx}`).alignment = { horizontal: 'center' };

            sheet.getCell(`F${rIdx}`).value = i;
            sheet.getCell(`F${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`G${rIdx}`).value = n ? (n.description || '') : '';

            sheet.getRow(rIdx).height = 19;
            rIdx++;
        }

        // Show Stoppers Section
        sheet.mergeCells(`F${rIdx}:G${rIdx}`);
        const stHeader = sheet.getCell(`F${rIdx}`);
        stHeader.value = 'Show Stoppers (since nos. of weeks)';
        stHeader.font = { bold: true, size: 9.5 };
        stHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        stHeader.alignment = { horizontal: 'center' };
        sheet.getRow(rIdx).height = 20;
        rIdx++;

        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.mergeCells(`B${rIdx}:C${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'Concern Areas';
        sheet.mergeCells(`D${rIdx}:E${rIdx}`);
        sheet.getCell(`D${rIdx}`).value = '1st Intimation Date';
        sheet.getCell(`F${rIdx}`).value = 'S. No.';
        sheet.getCell(`G${rIdx}`).value = 'Concern Areas';
        ['A', 'B', 'D', 'F', 'G'].forEach((c) => {
            const cell = sheet.getCell(`${c}${rIdx}`);
            cell.font = { bold: true, size: 8.5 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.alignment = { horizontal: 'center' };
        });
        sheet.getRow(rIdx).height = 18;
        rIdx++;

        const stoppers = Array.isArray(dpr.show_stoppers) ? dpr.show_stoppers : [];
        for (let i = 1; i <= 10; i++) {
            const s = stoppers[i - 1];
            sheet.getCell(`A${rIdx}`).value = i <= 9 ? i : '';
            sheet.getCell(`A${rIdx}`).alignment = { horizontal: 'center' };
            sheet.mergeCells(`B${rIdx}:C${rIdx}`);
            sheet.getCell(`B${rIdx}`).value = s ? (s.concern_area || '') : '';
            sheet.mergeCells(`D${rIdx}:E${rIdx}`);
            sheet.getCell(`D${rIdx}`).value = s ? formatDisplayDate(s.intimation_date) : '';
            sheet.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };

            sheet.getCell(`F${rIdx}`).value = i;
            sheet.getCell(`F${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`G${rIdx}`).value = '';

            sheet.getRow(rIdx).height = 17;
            rIdx++;
        }

        // Manpower Deployment Header & Subheaders
        sheet.getCell(`A${rIdx}`).value = 'S. No.';
        sheet.mergeCells(`B${rIdx}:C${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'Daily Progress for Manpower (Type & Count)';
        sheet.getCell(`D${rIdx}`).value = 'Required';
        sheet.getCell(`E${rIdx}`).value = 'Available';
        sheet.mergeCells(`F${rIdx}:G${rIdx}`);
        sheet.getCell(`F${rIdx}`).value = 'PHOTO: 1';
        ['A', 'B', 'D', 'E', 'F'].forEach((c) => {
            const cell = sheet.getCell(`${c}${rIdx}`);
            cell.font = { bold: true, size: 8.5 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.alignment = { horizontal: 'center' };
        });
        sheet.getRow(rIdx).height = 20;
        const mpStartRow = rIdx;
        rIdx++;

        const defaultTrades = [
            { trade: 'EHS Officer', defaultAvail: 1 },
            { trade: 'Electrician', defaultAvail: 0 },
            { trade: 'Engineer', defaultAvail: 0 },
            { trade: 'Fitter', defaultAvail: 0 },
            { trade: 'Welder', defaultAvail: 0 },
            { trade: 'Helper', defaultAvail: 7 },
            { trade: 'supervisor', defaultAvail: 0 },
            { trade: 'Testing engineer', defaultAvail: 0 },
            { trade: 'Cable jointer', defaultAvail: 0 },
            { trade: 'Scaffolding erection team', defaultAvail: 0 },
            { trade: 'Site Manager', defaultAvail: 1 }
        ];

        let totAvail = 0;
        let totReq = 0;
        defaultTrades.forEach((item, idx) => {
            const match = (dpr.manpower_data || []).find(m => m.trade?.toLowerCase() === item.trade.toLowerCase()) || {};
            const req = match.required !== undefined && match.required !== '' ? match.required : '';
            const avail = match.available !== undefined && match.available !== '' ? Number(match.available) : item.defaultAvail;
            totAvail += (Number(avail) || 0);
            if (Number(req)) totReq += Number(req);

            sheet.getCell(`A${rIdx}`).value = idx + 1;
            sheet.getCell(`A${rIdx}`).alignment = { horizontal: 'center' };
            sheet.mergeCells(`B${rIdx}:C${rIdx}`);
            sheet.getCell(`B${rIdx}`).value = item.trade;
            sheet.getCell(`D${rIdx}`).value = req !== '' ? Number(req) : '';
            sheet.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
            sheet.getCell(`E${rIdx}`).value = Number(avail) || 0;
            sheet.getCell(`E${rIdx}`).alignment = { horizontal: 'center' };

            sheet.getRow(rIdx).height = 16;
            rIdx++;
        });

        // Total Row with Bright Yellow Highlight
        sheet.getCell(`A${rIdx}`).value = '';
        sheet.mergeCells(`B${rIdx}:C${rIdx}`);
        sheet.getCell(`B${rIdx}`).value = 'Total';
        sheet.getCell(`B${rIdx}`).font = { bold: true };
        sheet.getCell(`B${rIdx}`).alignment = { horizontal: 'right' };
        sheet.getCell(`D${rIdx}`).value = totReq > 0 ? totReq : '';
        sheet.getCell(`D${rIdx}`).font = { bold: true };
        sheet.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };

        // Bright Yellow Available Cell!
        const availTotCell = sheet.getCell(`E${rIdx}`);
        availTotCell.value = totAvail;
        availTotCell.font = { bold: true, color: { argb: 'FF000000' } };
        availTotCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // EXACT YELLOW
        availTotCell.alignment = { horizontal: 'center' };
        sheet.getRow(rIdx).height = 18;

        // Merge Photo 1 Area across the rows of the manpower table
        sheet.mergeCells(`F${mpStartRow + 1}:G${rIdx}`);
        const p1Cell = sheet.getCell(`F${mpStartRow + 1}`);
        p1Cell.value = '#REF! [PHOTO : 1]';
        p1Cell.alignment = { horizontal: 'center', vertical: 'middle' };
        p1Cell.font = { italic: true, color: { argb: 'FF94A3B8' } };
        rIdx++;

        rIdx++; // spacer

        // Photo Grid Rows (Photos 2 to 7)
        sheet.mergeCells(`A${rIdx}:B${rIdx + 4}`);
        sheet.getCell(`A${rIdx}`).value = 'Photo 2 [PHOTO:2]';
        sheet.getCell(`A${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(`C${rIdx}:E${rIdx + 4}`);
        sheet.getCell(`C${rIdx}`).value = 'Photo 3 [PHOTO:3]';
        sheet.getCell(`C${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(`F${rIdx}:G${rIdx + 4}`);
        sheet.getCell(`F${rIdx}`).value = 'Photo 4 [PHOTO:4]';
        sheet.getCell(`F${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
        rIdx += 6;

        sheet.mergeCells(`A${rIdx}:B${rIdx + 4}`);
        sheet.getCell(`A${rIdx}`).value = 'Photo 5 [PHOTO:5]';
        sheet.getCell(`A${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(`C${rIdx}:E${rIdx + 4}`);
        sheet.getCell(`C${rIdx}`).value = 'Photo 6 [PHOTO:6]';
        sheet.getCell(`C${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(`F${rIdx}:G${rIdx + 4}`);
        sheet.getCell(`F${rIdx}`).value = 'Photo 7 [PHOTO:7]';
        sheet.getCell(`F${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
        rIdx += 6;

        // Apply clean border styling across all rows
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });
        });

        // Set response headers and stream output
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="DPR_${String(dpr.report_no || dpr.dpr_id).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    }

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
