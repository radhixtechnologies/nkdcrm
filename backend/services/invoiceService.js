const db = require('../config/database');

const invoiceService = {
    // --- Clients (Client Master) ---
    async getClients() {
        const query = `
            SELECT c.*, COUNT(s.site_id) as site_count
            FROM clients c
            LEFT JOIN sites s ON s.client_id = c.client_id
            GROUP BY c.client_id
            ORDER BY c.client_name ASC
        `;
        const res = await db.query(query);
        return res.rows;
    },

    async createClient(data) {
        const clientCode = data.client_code || `CL-${Date.now().toString().slice(-6)}`;
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
            data.is_active !== undefined ? data.is_active : true
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateClient(clientId, data) {
        const query = `
            UPDATE clients SET
                client_name = COALESCE($1, client_name),
                company_name = COALESCE($2, company_name),
                gstin = COALESCE($3, gstin),
                pan = COALESCE($4, pan),
                contact_person = COALESCE($5, contact_person),
                email = COALESCE($6, email),
                phone = COALESCE($7, phone),
                billing_address = COALESCE($8, billing_address),
                city = COALESCE($9, city),
                state = COALESCE($10, state),
                pincode = COALESCE($11, pincode),
                is_active = COALESCE($12, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $13
            RETURNING *
        `;
        const params = [
            data.client_name, data.company_name, data.gstin, data.pan,
            data.contact_person, data.email, data.phone, data.billing_address,
            data.city, data.state, data.pincode, data.is_active, clientId
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- Invoices (Billing & Deployment Invoices) ---
    async getInvoices(filters = {}) {
        let query = `
            SELECT i.*, 
                   c.client_name, c.client_code, c.gstin as client_gstin,
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

        query += ` ORDER BY i.created_at DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createInvoice(data) {
        const invoiceNumber = data.invoice_number || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
        const subtotal = parseFloat(data.subtotal) || 0;
        const taxRate = parseFloat(data.tax_rate) || 18; // default 18% GST in India
        const taxAmount = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
        const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

        // Client TDS (e.g. 194C 1% or 2%)
        const tdsRate = parseFloat(data.tds_rate) || 0;
        const tdsAmount = parseFloat(((subtotal * tdsRate) / 100).toFixed(2));
        const netReceivable = parseFloat((totalAmount - tdsAmount).toFixed(2));

        const dueDate = data.due_date || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const query = `
            INSERT INTO invoices (
                invoice_number, client_id, site_id, billing_month, billing_year,
                subtotal, tax_amount, total_amount, tds_rate, tds_amount, net_receivable,
                status, issue_date, due_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;
        const params = [
            invoiceNumber,
            data.client_id || null,
            data.site_id || null,
            data.billing_month || new Date().getMonth() + 1,
            data.billing_year || new Date().getFullYear(),
            subtotal,
            taxAmount,
            totalAmount,
            tdsRate,
            tdsAmount,
            netReceivable,
            data.status || 'PENDING',
            data.issue_date || new Date().toISOString().split('T')[0],
            dueDate,
            data.notes || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateInvoiceStatus(invoiceId, status, paymentDetails = {}) {
        const query = `
            UPDATE invoices SET
                status = $1,
                paid_date = CASE WHEN $1 = 'PAID' THEN CURRENT_DATE ELSE paid_date END,
                payment_mode = COALESCE($2, payment_mode),
                updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = $3
            RETURNING *
        `;
        const res = await db.query(query, [status, paymentDetails.payment_mode || null, invoiceId]);
        return res.rows[0];
    },

    // --- Invoice Summary for Dashboard ---
    async getInvoiceStats() {
        const statsQuery = `
            SELECT
                COALESCE(SUM(total_amount), 0)::numeric as total_invoiced,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0)::numeric as total_received,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN total_amount ELSE 0 END), 0)::numeric as pending_amount,
                COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN total_amount ELSE 0 END), 0)::numeric as overdue_amount,
                COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int as paid_count,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int as pending_count,
                COUNT(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN 1 END)::int as overdue_count
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
        // 1. Missing KYC / Compliance checks on Active Employees
        const kycQuery = `
            SELECT
                COUNT(CASE WHEN uan_number IS NULL OR uan_number = '' THEN 1 END)::int as missing_uan,
                COUNT(CASE WHEN esi_number IS NULL OR esi_number = '' THEN 1 END)::int as missing_esic,
                COUNT(CASE WHEN pan_number IS NULL OR pan_number = '' THEN 1 END)::int as missing_pan,
                COUNT(CASE WHEN aadhaar_number IS NULL OR aadhaar_number = '' THEN 1 END)::int as missing_aadhaar,
                COUNT(CASE WHEN account_number IS NULL OR account_number = '' THEN 1 END)::int as missing_bank,
                COUNT(*)::int as total_active_staff
            FROM employees
            WHERE employment_status = 'ACTIVE'
        `;
        const kycRes = await db.query(kycQuery);
        const kyc = kycRes.rows[0] || {};

        // 2. Statutory Due Dates Calculation (Indian Labor Laws)
        // PF Challan due on 15th of every month
        // ESIC Challan due on 15th of every month
        // PT Return due by end of month
        const today = new Date();
        const currentDay = today.getDate();
        const pfDueDate = 15;
        const daysToPf = pfDueDate >= currentDay ? pfDueDate - currentDay : (30 - currentDay + pfDueDate);

        const alerts = [];

        if (daysToPf <= 5) {
            alerts.push({
                id: 'pf_esi_due',
                type: 'CRITICAL',
                title: 'PF & ESIC Challan Due in ' + daysToPf + ' Days',
                description: 'EPF ECR & ESIC contribution filing deadline is the 15th of the month.',
                actionLink: '/reports'
            });
        } else {
            alerts.push({
                id: 'pf_esi_normal',
                type: 'INFO',
                title: 'PF & ESIC Monthly Filing Status',
                description: 'Next statutory due date is the 15th (' + daysToPf + ' days remaining).',
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

        // 3. Labour License Expiry Alerts (Contract Labour Regulation & Abolition Act)
        try {
            const licenseRes = await db.query(`
                SELECT site_name, labour_license_no, labour_license_expiry,
                       (labour_license_expiry - CURRENT_DATE)::int as days_remaining
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
                        description: `License #${site.labour_license_no || 'N/A'} expires on ${new Date(site.labour_license_expiry).toLocaleDateString()}. Apply for renewal.`,
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

