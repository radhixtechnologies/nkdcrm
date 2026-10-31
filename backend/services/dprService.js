const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

class DprService {
    /**
     * Get list of all DPRs with optional filters
     */
    async getAllDprs({ site_id, search, start_date, end_date } = {}) {
        let query = `
            SELECT
                d.*,
                s.site_name,
                s.site_code,
                s.city as site_city,
                u.email as created_by_email
            FROM daily_progress_reports d
            LEFT JOIN sites s ON d.site_id = s.site_id
            LEFT JOIN users u ON d.created_by = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (site_id && site_id !== 'ALL') {
            params.push(parseInt(site_id));
            query += ` AND d.site_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (d.report_no ILIKE $${params.length} OR d.client_name ILIKE $${params.length} OR s.site_name ILIKE $${params.length})`;
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
        return result.rows;
    }

    /**
     * Get single DPR by ID
     */
    async getDprById(id) {
        const query = `
            SELECT
                d.*,
                s.site_name,
                s.site_code,
                s.address as site_address,
                s.city as site_city,
                s.state as site_state,
                u.email as created_by_email
            FROM daily_progress_reports d
            LEFT JOIN sites s ON d.site_id = s.site_id
            LEFT JOIN users u ON d.created_by = u.user_id
            WHERE d.dpr_id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Create new DPR
     */
    async createDpr(data, userId = null) {
        // Auto-generate report_no if not provided
        let reportNo = data.report_no;
        if (!reportNo) {
            let sitePrefix = 'DPR';
            if (data.site_id) {
                const s = await pool.query('SELECT site_code, site_name FROM sites WHERE site_id = $1', [data.site_id]);
                if (s.rows[0]) {
                    sitePrefix = s.rows[0].site_code || s.rows[0].site_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
                }
            }
            const countRes = await pool.query('SELECT COUNT(*) as count FROM daily_progress_reports WHERE site_id = $1', [data.site_id]);
            const nextNum = parseInt(countRes.rows[0].count || 0) + 1;
            reportNo = `${sitePrefix}/${String(nextNum).padStart(3, '0')}`;
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
            ) RETURNING *
        `;

        const values = [
            reportNo,
            data.site_id ? parseInt(data.site_id) : null,
            data.report_date || new Date().toISOString().split('T')[0],
            data.client_name || 'LUMINA',
            data.contractor_name || 'NKD POWER SOLUTIONS PVT LTD',
            data.po_number || '',
            parseFloat(data.po_value || 0),
            parseFloat(data.current_billing_value || 0),
            parseFloat(data.billing_progress_pct || 0),
            data.start_date || null,
            data.completion_date || null,
            JSON.stringify(data.today_activities || []),
            JSON.stringify(data.next_day_activities || []),
            JSON.stringify(data.show_stoppers || []),
            JSON.stringify(data.manpower_data || []),
            JSON.stringify(data.photos || []),
            userId
        ];

        const res = await pool.query(query, values);
        return res.rows[0];
    }

    /**
     * Update existing DPR
     */
    async updateDpr(id, data) {
        const query = `
            UPDATE daily_progress_reports SET
                client_name = COALESCE($1, client_name),
                po_number = COALESCE($2, po_number),
                po_value = COALESCE($3, po_value),
                current_billing_value = COALESCE($4, current_billing_value),
                billing_progress_pct = COALESCE($5, billing_progress_pct),
                start_date = COALESCE($6, start_date),
                completion_date = COALESCE($7, completion_date),
                today_activities = COALESCE($8, today_activities),
                next_day_activities = COALESCE($9, next_day_activities),
                show_stoppers = COALESCE($10, show_stoppers),
                manpower_data = COALESCE($11, manpower_data),
                photos = COALESCE($12, photos),
                updated_at = CURRENT_TIMESTAMP
            WHERE dpr_id = $13
            RETURNING *
        `;

        const values = [
            data.client_name,
            data.po_number,
            data.po_value !== undefined ? parseFloat(data.po_value) : null,
            data.current_billing_value !== undefined ? parseFloat(data.current_billing_value) : null,
            data.billing_progress_pct !== undefined ? parseFloat(data.billing_progress_pct) : null,
            data.start_date,
            data.completion_date,
            data.today_activities ? JSON.stringify(data.today_activities) : null,
            data.next_day_activities ? JSON.stringify(data.next_day_activities) : null,
            data.show_stoppers ? JSON.stringify(data.show_stoppers) : null,
            data.manpower_data ? JSON.stringify(data.manpower_data) : null,
            data.photos ? JSON.stringify(data.photos) : null,
            id
        ];

        const res = await pool.query(query, values);
        return res.rows[0];
    }

    /**
     * Delete DPR
     */
    async deleteDpr(id) {
        await pool.query('DELETE FROM daily_progress_reports WHERE dpr_id = $1', [id]);
        return { success: true };
    }

    /**
     * Generate official printable PDF for DPR
     */
    async generateDprPdf(dpr, res) {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="DPR-${dpr.report_no.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
        doc.pipe(res);

        // Header
        doc.rect(36, 36, 523, 56).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
            .text('NKD POWER SOLUTIONS PVT LTD', 48, 46);
        doc.fontSize(9).font('Helvetica')
            .text('DAILY SITE PROGRESS REPORT (DPR) - ENGINEERING & INFRASTRUCTURE', 48, 64);
        doc.fontSize(8).fillColor('#94a3b8')
            .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 430, 48, { align: 'right', width: 110 });

        // Project Info Box
        doc.rect(36, 100, 523, 75).stroke('#cbd5e1');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');

        doc.text(`Project:`, 44, 108);
        doc.font('Helvetica').text(dpr.site_name || 'Site Project', 90, 108);

        doc.font('Helvetica-Bold').text(`Client:`, 320, 108);
        doc.font('Helvetica').text(dpr.client_name || 'Client', 360, 108);

        doc.font('Helvetica-Bold').text(`Report No:`, 44, 122);
        doc.font('Helvetica-Bold').fillColor('#0284c7').text(dpr.report_no, 100, 122);

        doc.font('Helvetica-Bold').fillColor('#1e293b').text(`Date:`, 320, 122);
        doc.font('Helvetica').text(dpr.report_date ? new Date(dpr.report_date).toLocaleDateString('en-IN') : 'N/A', 360, 122);

        doc.font('Helvetica-Bold').text(`PO Number:`, 44, 136);
        doc.font('Helvetica').text(dpr.po_number || 'N/A', 105, 136);

        doc.font('Helvetica-Bold').text(`PO Value:`, 320, 136);
        doc.font('Helvetica-Bold').fillColor('#059669').text(`INR ${parseFloat(dpr.po_value || 0).toLocaleString('en-IN')}`, 375, 136);

        doc.font('Helvetica-Bold').fillColor('#1e293b').text(`Duration:`, 44, 150);
        doc.font('Helvetica').text(`${dpr.start_date || 'N/A'} to ${dpr.completion_date || 'N/A'}`, 90, 150);

        doc.font('Helvetica-Bold').text(`Billing Progress:`, 320, 150);
        doc.font('Helvetica').text(`${dpr.billing_progress_pct || 0}%`, 400, 150);

        let curY = 186;

        // Section: Today's Activity Status
        doc.rect(36, curY, 523, 18).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text("TODAY'S WORK ACTIVITY STATUS", 44, curY + 4);
        curY += 22;

        const activities = Array.isArray(dpr.today_activities) ? dpr.today_activities : [];
        if (activities.length === 0) {
            doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('No activity items recorded for this date.', 44, curY);
            curY += 16;
        } else {
            activities.forEach((act, idx) => {
                doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(act.description || '', 60, curY, { width: 330 });
                doc.font('Helvetica-Bold').fillColor(act.status === 'complete' ? '#059669' : '#d97706')
                    .text((act.status || 'In Progress').toUpperCase(), 400, curY);
                doc.fillColor('#64748b').font('Helvetica').text(`Dep: ${act.dependencies || 'NKD'}`, 480, curY);
                curY += 20;
            });
        }

        curY += 10;

        // Section: Next Day Planning
        doc.rect(36, curY, 523, 18).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text("ACTIVITIES PLANNED FOR NEXT DAY", 44, curY + 4);
        curY += 22;

        const nextDay = Array.isArray(dpr.next_day_activities) ? dpr.next_day_activities : [];
        if (nextDay.length === 0) {
            doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('No carry-forward activities planned.', 44, curY);
            curY += 16;
        } else {
            nextDay.forEach((act, idx) => {
                doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(act.description || '', 60, curY, { width: 480 });
                curY += 18;
            });
        }

        curY += 10;

        // Section: Manpower Deployment Table
        doc.rect(36, curY, 523, 18).fill('#0284c7');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text("MANPOWER DEPLOYMENT (TRADE & COUNT)", 44, curY + 4);
        curY += 22;

        const manpower = Array.isArray(dpr.manpower_data) ? dpr.manpower_data : [];
        let totalReq = 0;
        let totalAvail = 0;

        // Mini Table Header
        doc.rect(36, curY, 523, 16).fill('#f8fafc');
        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
        doc.text('Trade / Skill Category', 44, curY + 4);
        doc.text('Required', 360, curY + 4);
        doc.text('Available (On Site)', 450, curY + 4);
        curY += 18;

        manpower.forEach((mp) => {
            const req = parseInt(mp.required || 0);
            const avail = parseInt(mp.available || 0);
            totalReq += req;
            totalAvail += avail;

            doc.fillColor('#334155').font('Helvetica').fontSize(8);
            doc.text(mp.trade || 'Worker', 44, curY);
            doc.text(String(req), 375, curY);
            doc.font('Helvetica-Bold').fillColor(avail > 0 ? '#0284c7' : '#94a3b8').text(String(avail), 475, curY);
            curY += 15;
        });

        // Total Row
        doc.rect(36, curY, 523, 16).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        doc.text('TOTAL MANPOWER ENGAGED', 44, curY + 4);
        doc.text(String(totalReq), 375, curY + 4);
        doc.fillColor('#0284c7').text(String(totalAvail), 475, curY + 4);
        curY += 26;

        // Showstoppers / Blockers if any
        const stoppers = Array.isArray(dpr.show_stoppers) ? dpr.show_stoppers : [];
        if (stoppers.length > 0) {
            doc.rect(36, curY, 523, 18).fill('#fee2e2');
            doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(9).text("SHOW STOPPERS / CONCERN AREAS", 44, curY + 4);
            curY += 22;
            stoppers.forEach((st, idx) => {
                doc.fillColor('#7f1d1d').font('Helvetica-Bold').fontSize(8).text(`${idx + 1}.`, 44, curY);
                doc.font('Helvetica').text(st.concern_area || '', 60, curY, { width: 380 });
                doc.text(`Intimated: ${st.intimation_date || 'N/A'}`, 450, curY);
                curY += 16;
            });
            curY += 10;
        }

        // Signatures at bottom
        const signY = 750;
        doc.strokeColor('#cbd5e1').lineWidth(1)
            .moveTo(44, signY).lineTo(180, signY).stroke()
            .moveTo(380, signY).lineTo(520, signY).stroke();

        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
            .text('SITE IN-CHARGE / ENGINEER', 44, signY + 6)
            .text('NKD Power Solutions Pvt Ltd', 44, signY + 16);

        doc.text('CLIENT REPRESENTATIVE', 380, signY + 6)
            .text(dpr.client_name || 'LUMINA', 380, signY + 16);

        doc.end();
    }
}

module.exports = new DprService();
