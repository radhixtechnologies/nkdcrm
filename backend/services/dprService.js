const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

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
                today_activities, next_day_activities, show_stoppers, manpower_data, photos,
                created_by
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11,
                $12, $13, $14, $15, $16,
                $17
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
                updated_at = CURRENT_TIMESTAMP
            WHERE dpr_id = $17
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
}

module.exports = new DprService();
