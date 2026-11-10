const db = require('../config/database');

const cleanInt = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
};

const invoiceService = {
    // --- Clients (Client Master) ---
    async getClients() {
        const query = `
            SELECT c.*, COUNT(s.site_id)::int AS site_count
            FROM clients c
            LEFT JOIN sites s ON s.client_id = c.client_id
            GROUP BY c.client_id
            ORDER BY c.client_name ASC
        `;
        const res = await db.query(query);
        return res.rows;
    },

    async createClient(data) {
        const clientCode = (data.client_code && String(data.client_code).trim())
            ? String(data.client_code).trim().toUpperCase()
            : `CL-${Date.now().toString().slice(-6)}`;

        const query = `
            INSERT INTO clients (
                client_code, client_name, company_name, gstin, pan,
                contact_person, email, phone, billing_address, city, state, pincode, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const params = [
            clientCode,
            data.client_name,
            data.company_name || data.client_name,
            data.gstin || null,
            data.pan || null,
            data.contact_person || null,
            data.email || null,
            data.phone || null,
            data.billing_address || null,
            data.city || null,
            data.state || null,
            data.pincode || null,
            data.is_active !== undefined ? Boolean(data.is_active) : true
        ];
        try {
            const res = await db.query(query, params);
            return res.rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`Client code "${clientCode}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    },

    async updateClient(clientId, data) {
        const existingRes = await db.query('SELECT * FROM clients WHERE client_id = $1', [clientId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Client not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const query = `
            UPDATE clients SET
                client_name = $1,
                company_name = $2,
                gstin = $3,
                pan = $4,
                contact_person = $5,
                email = $6,
                phone = $7,
                billing_address = $8,
                city = $9,
                state = $10,
                pincode = $11,
                is_active = $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $13
            RETURNING *
        `;
        const params = [
            data.client_name !== undefined ? data.client_name : ex.client_name,
            data.company_name !== undefined ? (data.company_name || null) : ex.company_name,
            data.gstin !== undefined ? (data.gstin || null) : ex.gstin,
            data.pan !== undefined ? (data.pan || null) : ex.pan,
            data.contact_person !== undefined ? (data.contact_person || null) : ex.contact_person,
            data.email !== undefined ? (data.email || null) : ex.email,
            data.phone !== undefined ? (data.phone || null) : ex.phone,
            data.billing_address !== undefined ? (data.billing_address || null) : ex.billing_address,
            data.city !== undefined ? (data.city || null) : ex.city,
            data.state !== undefined ? (data.state || null) : ex.state,
            data.pincode !== undefined ? (data.pincode || null) : ex.pincode,
            data.is_active !== undefined ? Boolean(data.is_active) : ex.is_active,
            clientId
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- Invoices (Billing & Deployment Invoices) ---
    async getInvoices(filters = {}) {
        let query = `
            SELECT i.*,
                   TO_CHAR(i.issue_date, 'YYYY-MM-DD') AS issue_date,
                   TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date,
                   TO_CHAR(i.paid_date, 'YYYY-MM-DD') AS paid_date,
                   c.client_name, c.client_code, c.gstin AS client_gstin,
                   s.site_name, s.site_code
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.client_id
            LEFT JOIN sites s ON i.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status && filters.status !== 'ALL') {
            params.push(filters.status);
            query += ` AND i.status = $${params.length}`;
        }
        if (filters.clientId) {
            params.push(filters.clientId);
            query += ` AND i.client_id = $${params.length}`;
        }

        query += ` ORDER BY i.issue_date DESC, i.created_at DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createInvoice(data) {
        const invoiceNumber = (data.invoice_number && String(data.invoice_number).trim())
            ? String(data.invoice_number).trim()
            : `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

        const subtotal = parseFloat(data.subtotal) || 0;
        const taxRate = (data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate !== '')
            ? parseFloat(data.tax_rate)
            : 18;
        const safeTaxRate = Number.isNaN(taxRate) ? 18 : taxRate;
        const taxAmount = parseFloat(((subtotal * safeTaxRate) / 100).toFixed(2));

        const isInterstate = Boolean(data.is_interstate || data.gst_type === 'IGST');
        const cgst = isInterstate ? 0 : parseFloat((taxAmount / 2).toFixed(2));
        const sgst = isInterstate ? 0 : parseFloat((taxAmount - cgst).toFixed(2));
        const igst = isInterstate ? taxAmount : 0;

        const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
        const tdsRate = parseFloat(data.tds_rate) || 0;
        const tdsAmount = parseFloat(((subtotal * tdsRate) / 100).toFixed(2));
        const netReceivable = parseFloat(Math.max(0, totalAmount - tdsAmount).toFixed(2));

        const istNowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const [istYear, istMonth] = istNowStr.split('-').map(Number);
        const dueDate = data.due_date && String(data.due_date).trim() !== ''
            ? data.due_date
            : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        const query = `
            INSERT INTO invoices (
                invoice_number, client_id, site_id, billing_month, billing_year,
                subtotal, cgst, sgst, igst, tax_amount, total_amount, tds_rate, tds_amount, net_receivable,
                status, issue_date, due_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *,
              TO_CHAR(issue_date, 'YYYY-MM-DD') AS issue_date,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
              TO_CHAR(paid_date, 'YYYY-MM-DD') AS paid_date
        `;
        const params = [
            invoiceNumber,
            cleanInt(data.client_id),
            cleanInt(data.site_id),
            parseInt(data.billing_month, 10) || istMonth,
            parseInt(data.billing_year, 10) || istYear,
            subtotal,
            cgst,
            sgst,
            igst,
            taxAmount,
            totalAmount,
            tdsRate,
            tdsAmount,
            netReceivable,
            data.status || 'PENDING',
            data.issue_date || istNowStr,
            dueDate,
            data.notes || null
        ];
        try {
            const res = await db.query(query, params);
            return res.rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`Invoice number "${invoiceNumber}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    },

    async updateInvoice(invoiceId, data) {
        const existingRes = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoiceId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const subtotal = data.subtotal !== undefined ? (parseFloat(data.subtotal) || 0) : parseFloat(ex.subtotal || 0);
        const existingRate = subtotal > 0 ? Math.round((parseFloat(ex.tax_amount || 0) / subtotal) * 10000) / 100 : 18;
        const taxRate = (data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate !== '')
            ? parseFloat(data.tax_rate)
            : existingRate;
        const safeTaxRate = Number.isNaN(taxRate) ? existingRate : taxRate;
        const taxAmount = parseFloat(((subtotal * safeTaxRate) / 100).toFixed(2));
        const isInterstate = data.is_interstate !== undefined
            ? Boolean(data.is_interstate)
            : (parseFloat(ex.igst || 0) > 0);
        const cgst = isInterstate ? 0 : parseFloat((taxAmount / 2).toFixed(2));
        const sgst = isInterstate ? 0 : parseFloat((taxAmount - cgst).toFixed(2));
        const igst = isInterstate ? taxAmount : 0;

        const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
        const tdsRate = data.tds_rate !== undefined ? (parseFloat(data.tds_rate) || 0) : parseFloat(ex.tds_rate || 0);
        const tdsAmount = parseFloat(((subtotal * tdsRate) / 100).toFixed(2));
        const netReceivable = parseFloat(Math.max(0, totalAmount - tdsAmount).toFixed(2));

        const res = await db.query(`
            UPDATE invoices SET
                client_id = $1,
                site_id = $2,
                billing_month = $3,
                billing_year = $4,
                subtotal = $5,
                cgst = $6,
                sgst = $7,
                igst = $8,
                tax_amount = $9,
                tds_rate = $10,
                tds_amount = $11,
                total_amount = $12,
                net_receivable = $13,
                status = $14,
                issue_date = $15,
                due_date = $16,
                notes = $17,
                updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = $18
            RETURNING *,
              TO_CHAR(issue_date, 'YYYY-MM-DD') AS issue_date,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
              TO_CHAR(paid_date, 'YYYY-MM-DD') AS paid_date
        `, [
            data.client_id !== undefined ? cleanInt(data.client_id) : ex.client_id,
            data.site_id !== undefined ? cleanInt(data.site_id) : ex.site_id,
            data.billing_month !== undefined ? (parseInt(data.billing_month, 10) || ex.billing_month) : ex.billing_month,
            data.billing_year !== undefined ? (parseInt(data.billing_year, 10) || ex.billing_year) : ex.billing_year,
            subtotal,
            cgst,
            sgst,
            igst,
            taxAmount,
            tdsRate,
            tdsAmount,
            totalAmount,
            netReceivable,
            data.status !== undefined ? data.status : ex.status,
            data.issue_date !== undefined ? (data.issue_date || ex.issue_date) : ex.issue_date,
            data.due_date !== undefined ? (data.due_date || ex.due_date) : ex.due_date,
            data.notes !== undefined ? (data.notes || null) : ex.notes,
            invoiceId
        ]);
        return res.rows[0];
    },

    async deleteInvoice(invoiceId) {
        const res = await db.query('DELETE FROM invoices WHERE invoice_id = $1 RETURNING invoice_id', [invoiceId]);
        if (res.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        return { success: true, message: 'Invoice deleted successfully' };
    },

    async updateInvoiceStatus(invoiceId, status, paymentDetails = {}) {
        const query = `
            UPDATE invoices SET
                status = $1,
                paid_date = CASE WHEN $1 = 'PAID' THEN CURRENT_DATE ELSE NULL END,
                payment_mode = COALESCE($2, payment_mode),
                updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = $3
            RETURNING *,
              TO_CHAR(issue_date, 'YYYY-MM-DD') AS issue_date,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
              TO_CHAR(paid_date, 'YYYY-MM-DD') AS paid_date
        `;
        const res = await db.query(query, [status, paymentDetails.payment_mode || null, invoiceId]);
        if (res.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        return res.rows[0];
    },

    // --- Invoice Summary for Dashboard ---
    async getInvoiceStats() {
        const statsQuery = `
            SELECT
                COALESCE(SUM(total_amount), 0)::numeric AS total_invoiced,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0)::numeric AS total_received,
                COALESCE(SUM(CASE WHEN status = 'PENDING' AND due_date >= CURRENT_DATE THEN total_amount ELSE 0 END), 0)::numeric AS pending_amount,
                COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN total_amount ELSE 0 END), 0)::numeric AS overdue_amount,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int AS paid_count,
                COUNT(CASE WHEN status = 'PENDING' AND due_date >= CURRENT_DATE THEN 1 END)::int AS pending_count,
                COUNT(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN 1 END)::int AS overdue_count
            FROM invoices
        `;
        const res = await db.query(statsQuery);
        return res.rows[0] || {
            total_invoiced: 0,
            total_received: 0,
            pending_amount: 0,
            overdue_amount: 0,
            paid_count: 0,
            pending_count: 0,
            overdue_count: 0
        };
    },

    // --- Compliance Alerts for Dashboard ---
    async getComplianceAlerts() {
        const kycQuery = `
            SELECT
                COUNT(CASE WHEN uan_number IS NULL OR uan_number = '' THEN 1 END)::int AS missing_uan,
                COUNT(CASE WHEN esi_number IS NULL OR esi_number = '' THEN 1 END)::int AS missing_esic,
                COUNT(CASE WHEN pan_number IS NULL OR pan_number = '' THEN 1 END)::int AS missing_pan,
                COUNT(CASE WHEN aadhaar_number IS NULL OR aadhaar_number = '' THEN 1 END)::int AS missing_aadhaar,
                COUNT(CASE WHEN account_number IS NULL OR account_number = '' THEN 1 END)::int AS missing_bank,
                COUNT(*)::int AS total_active_staff
            FROM employees
            WHERE employment_status = 'ACTIVE'
        `;
        const kycRes = await db.query(kycQuery);
        const kyc = kycRes.rows[0] || {};

        const today = new Date();
        const currentDay = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const pfDueDate = 15;
        const daysToPf = pfDueDate >= currentDay ? (pfDueDate - currentDay) : (daysInMonth - currentDay + pfDueDate);

        const alerts = [];

        if (daysToPf <= 5) {
            alerts.push({
                id: 'pf_esi_due',
                type: 'CRITICAL',
                title: `PF & ESIC Challan Due in ${daysToPf} Day(s)`,
                description: 'EPF ECR & ESIC contribution filing deadline is the 15th of the month.',
                actionLink: '/reports'
            });
        } else {
            alerts.push({
                id: 'pf_esi_normal',
                type: 'INFO',
                title: 'PF & ESIC Monthly Filing Status',
                description: `Next statutory due date is the 15th (${daysToPf} days remaining).`,
                actionLink: '/reports'
            });
        }

        if (kyc.missing_uan > 0) {
            alerts.push({
                id: 'missing_uan',
                type: 'WARNING',
                title: `${kyc.missing_uan} Active Employees Missing UAN`,
                description: 'PF compliance requires valid Universal Account Numbers linked to payroll.',
                actionLink: '/employees'
            });
        }

        if (kyc.missing_bank > 0) {
            alerts.push({
                id: 'missing_bank',
                type: 'WARNING',
                title: `${kyc.missing_bank} Employees Missing Bank Account`,
                description: 'Direct salary disbursement requires account numbers and IFSC codes.',
                actionLink: '/employees'
            });
        }

        if (kyc.missing_aadhaar > 0 || kyc.missing_pan > 0) {
            alerts.push({
                id: 'missing_kyc',
                type: 'INFO',
                title: `KYC Pending: ${kyc.missing_aadhaar} Aadhaar, ${kyc.missing_pan} PAN`,
                description: 'Statutory verification documents pending upload in employee master.',
                actionLink: '/employees'
            });
        }

        try {
            const licenseRes = await db.query(`
                SELECT site_name, labour_license_no, labour_license_expiry,
                       (labour_license_expiry - CURRENT_DATE)::int AS days_remaining
                FROM sites
                WHERE labour_license_expiry IS NOT NULL
                  AND (labour_license_expiry - CURRENT_DATE) <= 30
                ORDER BY labour_license_expiry ASC
            `);

            licenseRes.rows.forEach(site => {
                if (site.days_remaining < 0) {
                    alerts.unshift({
                        id: `license_expired_${site.site_name}`,
                        type: 'CRITICAL',
                        title: `Labour License EXPIRED: ${site.site_name}`,
                        description: `License #${site.labour_license_no || 'N/A'} expired ${Math.abs(site.days_remaining)} days ago. Immediate renewal required under CLRA.`,
                        actionLink: '/sites'
                    });
                } else {
                    alerts.push({
                        id: `license_expiring_${site.site_name}`,
                        type: 'WARNING',
                        title: `Labour License Expiring in ${site.days_remaining} Days: ${site.site_name}`,
                        description: `License #${site.labour_license_no || 'N/A'} expires on ${new Date(site.labour_license_expiry).toLocaleDateString('en-IN')}. Apply for renewal.`,
                        actionLink: '/sites'
                    });
                }
            });
        } catch (e) {
            console.warn('Labour license alerts query warning:', e.message);
        }

        return {
            summary: kyc,
            alerts
        };
    }
};

module.exports = invoiceService;
