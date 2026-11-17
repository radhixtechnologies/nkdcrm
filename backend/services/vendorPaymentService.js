const db = require('../config/database');
const xlsx = require('xlsx');

const cleanNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const vendorPaymentService = {
    // 1. Dashboard Metrics and Summaries
    async getDashboardStats() {
        // Global sums
        const kpiRes = await db.query(`
            SELECT
                COUNT(*)::int AS total_items,
                COALESCE(SUM(total_payable), 0)::numeric(14,2) AS total_payable,
                COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS total_paid,
                COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS total_outstanding,
                COALESCE(SUM(gst_amount), 0)::numeric(14,2) AS total_gst,
                COALESCE(SUM(tds_amount), 0)::numeric(14,2) AS total_tds,
                COALESCE(SUM(basic_amount), 0)::numeric(14,2) AS total_basic,
                COALESCE(SUM(invoice_value), 0)::numeric(14,2) AS total_invoice_value,
                COUNT(CASE WHEN status IN ('PART_PAID', 'OUTSTANDING') THEN 1 END)::int AS open_invoices,
                COUNT(CASE WHEN status = 'AWAITING_INVOICE' THEN 1 END)::int AS awaiting_invoice_count
            FROM vendor_invoices
        `);
        const kpi = kpiRes.rows[0];

        // Status breakdown
        const statusRes = await db.query(`
            SELECT
                status,
                COUNT(*)::int AS invoices,
                COALESCE(SUM(total_payable), 0)::numeric(14,2) AS payable,
                COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS paid,
                COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS outstanding
            FROM vendor_invoices
            GROUP BY status
            ORDER BY CASE
                WHEN status = 'PAID' THEN 1
                WHEN status = 'PART_PAID' THEN 2
                WHEN status = 'OUTSTANDING' THEN 3
                WHEN status = 'AWAITING_INVOICE' THEN 4
                ELSE 5
            END
        `);

        const totalOut = parseFloat(kpi.total_outstanding) || 1;
        const statusBreakdown = statusRes.rows.map(row => {
            const outVal = parseFloat(row.outstanding) || 0;
            const pct = totalOut > 0 ? ((outVal / totalOut) * 100).toFixed(1) : '0.0';
            return {
                ...row,
                percent_outst: `${pct}%`
            };
        });

        // Site-wise position
        const siteRes = await db.query(`
            SELECT
                site_name,
                COUNT(CASE WHEN status != 'AWAITING_INVOICE' THEN 1 END)::int AS invoices,
                COALESCE(SUM(basic_amount), 0)::numeric(14,2) AS invoice_value,
                COALESCE(SUM(total_payable), 0)::numeric(14,2) AS payable,
                COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS paid,
                COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS outstanding
            FROM vendor_invoices
            WHERE status != 'AWAITING_INVOICE'
            GROUP BY site_name
            ORDER BY site_name ASC
        `);

        const sitePositions = siteRes.rows.map(row => {
            const payable = parseFloat(row.payable) || 0;
            const paid = parseFloat(row.paid) || 0;
            const pctPaid = payable > 0 ? Math.round((paid / payable) * 100) : (paid > 0 ? 100 : 0);
            return {
                ...row,
                invoice_value: parseFloat(row.invoice_value) || 0,
                percent_paid: `${pctPaid}%`
            };
        });

        // Add 0 invoices for JSW JAIGARH if not already in list
        const hasJaigarh = sitePositions.some(s => s.site_name.toUpperCase().includes('JAIGARH'));
        if (!hasJaigarh) {
            sitePositions.push({
                site_name: 'JSW JAIGARH',
                invoices: 0,
                invoice_value: 0,
                payable: '0.00',
                paid: '0.00',
                outstanding: '0.00',
                percent_paid: '0%'
            });
        }

        return {
            kpi: {
                total_payable: parseFloat(kpi.total_payable),
                total_paid: parseFloat(kpi.total_paid),
                total_outstanding: parseFloat(kpi.total_outstanding),
                open_invoices: parseInt(kpi.open_invoices, 10),
                awaiting_invoice_count: parseInt(kpi.awaiting_invoice_count, 10),
                total_gst: parseFloat(kpi.total_gst),
                total_tds: parseFloat(kpi.total_tds),
                total_basic: parseFloat(kpi.total_basic),
                invoice_value: parseFloat(kpi.total_basic),
                gross_invoice_value: parseFloat(kpi.total_invoice_value),
                paid_percent: (parseFloat(kpi.total_payable) > 0 ? ((parseFloat(kpi.total_paid) / parseFloat(kpi.total_payable)) * 100).toFixed(1) : '0.0') + '%',
                outstanding_percent: (parseFloat(kpi.total_payable) > 0 ? ((parseFloat(kpi.total_outstanding) / parseFloat(kpi.total_payable)) * 100).toFixed(1) : '0.0') + '%'
            },
            status_breakdown: statusBreakdown,
            site_positions: sitePositions
        };
    },

    // 2. Fetch Invoices with Filtering & Pagination/Search
    async getInvoices(filters = {}) {
        let query = `
            SELECT
                i.*,
                TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS invoice_date,
                TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date,
                COALESCE(p.payment_count, 0)::int AS payment_count,
                p.last_payment_date,
                p.last_payment_mode,
                p.last_transaction_ref
            FROM vendor_invoices i
            LEFT JOIN (
                SELECT
                    invoice_id,
                    COUNT(*)::int AS payment_count,
                    MAX(TO_CHAR(payment_date, 'YYYY-MM-DD')) AS last_payment_date,
                    (ARRAY_AGG(payment_mode ORDER BY payment_date DESC))[1] AS last_payment_mode,
                    (ARRAY_AGG(transaction_reference ORDER BY payment_date DESC))[1] AS last_transaction_ref
                FROM vendor_payments
                GROUP BY invoice_id
            ) p ON p.invoice_id = i.invoice_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status && filters.status !== 'ALL') {
            params.push(filters.status);
            query += ` AND i.status = $${params.length}`;
        }
        if (filters.site_name && filters.site_name !== 'ALL') {
            params.push(filters.site_name);
            query += ` AND i.site_name = $${params.length}`;
        }
        if (filters.vendor_name && filters.vendor_name !== 'ALL') {
            params.push(filters.vendor_name);
            query += ` AND i.vendor_name = $${params.length}`;
        }
        if (filters.search) {
            params.push(`%${filters.search}%`);
            query += ` AND (i.invoice_number ILIKE $${params.length} OR i.vendor_name ILIKE $${params.length} OR i.po_number ILIKE $${params.length} OR i.remarks ILIKE $${params.length})`;
        }

        query += ` ORDER BY i.invoice_id DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    // 3. Get single invoice with complete payment history
    async getInvoiceById(id) {
        const invRes = await db.query(`
            SELECT
                i.*,
                TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS invoice_date,
                TO_CHAR(i.due_date, 'YYYY-MM-DD') AS due_date
            FROM vendor_invoices i
            WHERE i.invoice_id = $1
        `, [id]);

        if (invRes.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }

        const paymentsRes = await db.query(`
            SELECT
                payment_id,
                invoice_id,
                TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date,
                amount_paid,
                payment_mode,
                transaction_reference,
                bank_name,
                paid_by,
                remarks,
                created_at
            FROM vendor_payments
            WHERE invoice_id = $1
            ORDER BY payment_date DESC, payment_id DESC
        `, [id]);

        return {
            ...invRes.rows[0],
            payments: paymentsRes.rows
        };
    },

    // 4. Create new Invoice
    async createInvoice(data) {
        const basic = cleanNum(data.basic_amount, 0);
        const gstRate = cleanNum(data.gst_rate, 18.00);
        const gstAmount = (data.gst_amount !== undefined && data.gst_amount !== null && data.gst_amount !== '') ? cleanNum(data.gst_amount) : Math.round((basic * (gstRate / 100)) * 100) / 100;
        const tdsRate = cleanNum(data.tds_rate, 2.00);
        const tdsAmount = (data.tds_amount !== undefined && data.tds_amount !== null && data.tds_amount !== '') ? cleanNum(data.tds_amount) : Math.round((basic * (tdsRate / 100)) * 100) / 100;
        const invoiceValue = (data.invoice_value !== undefined && data.invoice_value !== null && data.invoice_value !== '') ? cleanNum(data.invoice_value) : (basic + gstAmount);
        const totalPayable = (data.total_payable !== undefined && data.total_payable !== null && data.total_payable !== '') ? cleanNum(data.total_payable) : (invoiceValue - tdsAmount);

        const paid = cleanNum(data.paid_amount, 0);
        const outstanding = Math.max(0, totalPayable - paid);

        let status = data.status || 'OUTSTANDING';
        if (data.status === 'AWAITING_INVOICE') {
            status = 'AWAITING_INVOICE';
        } else if (paid >= totalPayable && outstanding <= 0) {
            status = 'PAID';
        } else if (paid > 0 && outstanding > 0) {
            status = 'PART_PAID';
        } else {
            status = 'OUTSTANDING';
        }

        const query = `
            INSERT INTO vendor_invoices (
                vendor_id, site_id, vendor_name, site_name,
                invoice_number, invoice_date, due_date, po_number,
                category, basic_amount, gst_rate, gst_amount, tds_rate, tds_amount,
                invoice_value, total_payable, paid_amount, outstanding_amount, status, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING *,
                TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date,
                TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
        `;
        const params = [
            data.vendor_id || null,
            data.site_id || null,
            data.vendor_name,
            data.site_name,
            data.invoice_number,
            data.invoice_date || new Date().toISOString().split('T')[0],
            data.due_date || null,
            data.po_number || null,
            data.category || 'MATERIAL',
            basic,
            gstRate,
            gstAmount,
            tdsRate,
            tdsAmount,
            invoiceValue,
            totalPayable,
            paid,
            outstanding,
            status,
            data.remarks || null
        ];

        const res = await db.query(query, params);
        return res.rows[0];
    },

    // 5. Update Invoice
    async updateInvoice(id, data) {
        const exRes = await db.query('SELECT * FROM vendor_invoices WHERE invoice_id = $1', [id]);
        if (exRes.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        const ex = exRes.rows[0];

        const basic = data.basic_amount !== undefined ? cleanNum(data.basic_amount) : parseFloat(ex.basic_amount);
        const gstRate = data.gst_rate !== undefined ? cleanNum(data.gst_rate) : parseFloat(ex.gst_rate);
        const gstAmount = data.gst_amount !== undefined ? cleanNum(data.gst_amount) : parseFloat(ex.gst_amount);
        const tdsRate = data.tds_rate !== undefined ? cleanNum(data.tds_rate) : parseFloat(ex.tds_rate);
        const tdsAmount = data.tds_amount !== undefined ? cleanNum(data.tds_amount) : parseFloat(ex.tds_amount);
        const invoiceValue = data.invoice_value !== undefined ? cleanNum(data.invoice_value) : parseFloat(ex.invoice_value);
        const totalPayable = data.total_payable !== undefined ? cleanNum(data.total_payable) : parseFloat(ex.total_payable);

        // Fetch current paid from vendor_payments if payments exist
        const pSumRes = await db.query('SELECT COALESCE(SUM(amount_paid), 0)::numeric AS sum_paid FROM vendor_payments WHERE invoice_id = $1', [id]);
        const sumPaid = parseFloat(pSumRes.rows[0].sum_paid);
        const paid = sumPaid > 0 ? sumPaid : (data.paid_amount !== undefined ? cleanNum(data.paid_amount) : parseFloat(ex.paid_amount));
        const outstanding = Math.max(0, totalPayable - paid);

        let status = data.status || ex.status;
        if (status !== 'AWAITING_INVOICE') {
            if (paid >= totalPayable && outstanding <= 0) {
                status = 'PAID';
            } else if (paid > 0 && outstanding > 0) {
                status = 'PART_PAID';
            } else {
                status = 'OUTSTANDING';
            }
        }

        const query = `
            UPDATE vendor_invoices SET
                vendor_id = $1,
                site_id = $2,
                vendor_name = $3,
                site_name = $4,
                invoice_number = $5,
                invoice_date = $6,
                due_date = $7,
                po_number = $8,
                category = $9,
                basic_amount = $10,
                gst_rate = $11,
                gst_amount = $12,
                tds_rate = $13,
                tds_amount = $14,
                invoice_value = $15,
                total_payable = $16,
                paid_amount = $17,
                outstanding_amount = $18,
                status = $19,
                remarks = $20,
                updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = $21
            RETURNING *,
                TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date,
                TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
        `;
        const params = [
            data.vendor_id !== undefined ? data.vendor_id : ex.vendor_id,
            data.site_id !== undefined ? data.site_id : ex.site_id,
            data.vendor_name || ex.vendor_name,
            data.site_name || ex.site_name,
            data.invoice_number || ex.invoice_number,
            data.invoice_date || ex.invoice_date,
            data.due_date !== undefined ? data.due_date : ex.due_date,
            data.po_number !== undefined ? data.po_number : ex.po_number,
            data.category || ex.category,
            basic,
            gstRate,
            gstAmount,
            tdsRate,
            tdsAmount,
            invoiceValue,
            totalPayable,
            paid,
            outstanding,
            status,
            data.remarks !== undefined ? data.remarks : ex.remarks,
            id
        ];

        const res = await db.query(query, params);
        return res.rows[0];
    },

    // 6. Delete Invoice
    async deleteInvoice(id) {
        const res = await db.query('DELETE FROM vendor_invoices WHERE invoice_id = $1 RETURNING invoice_id', [id]);
        if (res.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        return { success: true, message: 'Vendor invoice deleted successfully' };
    },

    // 7. Record Payment against Invoice
    async recordPayment(invoiceId, paymentData) {
        const invRes = await db.query('SELECT * FROM vendor_invoices WHERE invoice_id = $1', [invoiceId]);
        if (invRes.rows.length === 0) {
            const err = new Error('Invoice not found');
            err.status = 404;
            throw err;
        }
        const invoice = invRes.rows[0];
        const amount = cleanNum(paymentData.amount_paid, 0);
        if (amount <= 0) {
            const err = new Error('Payment amount must be greater than zero');
            err.status = 400;
            throw err;
        }

        // Insert into vendor_payments
        const payRes = await db.query(`
            INSERT INTO vendor_payments (
                invoice_id, vendor_id, payment_date, amount_paid,
                payment_mode, transaction_reference, bank_name, paid_by, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *,
                TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date
        `, [
            invoiceId,
            invoice.vendor_id,
            paymentData.payment_date || new Date().toISOString().split('T')[0],
            amount,
            paymentData.payment_mode || 'NEFT/RTGS',
            paymentData.transaction_reference || null,
            paymentData.bank_name || 'HDFC Bank',
            paymentData.paid_by || 'Finance Department',
            paymentData.remarks || null
        ]);

        // Re-calculate total paid for this invoice
        const sumRes = await db.query(`
            SELECT COALESCE(SUM(amount_paid), 0)::numeric AS sum_paid
            FROM vendor_payments
            WHERE invoice_id = $1
        `, [invoiceId]);
        const totalPaid = parseFloat(sumRes.rows[0].sum_paid);
        const totalPayable = parseFloat(invoice.total_payable);
        const outstanding = Math.max(0, totalPayable - totalPaid);

        let newStatus = invoice.status;
        if (invoice.status !== 'AWAITING_INVOICE') {
            if (totalPaid >= totalPayable && outstanding <= 0) {
                newStatus = 'PAID';
            } else if (totalPaid > 0 && outstanding > 0) {
                newStatus = 'PART_PAID';
            } else {
                newStatus = 'OUTSTANDING';
            }
        }

        const updateRes = await db.query(`
            UPDATE vendor_invoices SET
                paid_amount = $1,
                outstanding_amount = $2,
                status = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE invoice_id = $4
            RETURNING *,
                TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date,
                TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
        `, [totalPaid, outstanding, newStatus, invoiceId]);

        return {
            payment: payRes.rows[0],
            invoice: updateRes.rows[0]
        };
    },

    // 8. Generate Excel Export Workbook
    async generateVendorPaymentsExcel() {
        const stats = await this.getDashboardStats();
        const allInvoices = await this.getInvoices();

        const wb = xlsx.utils.book_new();

        // Sheet 1: Dashboard Summary
        const summaryData = [
            ['VENDOR PAYMENT DASHBOARD | FY 2026-27'],
            ['N.K.D Power Solutions · Updates automatically from the Vendor Payment Tracker'],
            ['Generated on: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
            [],
            ['TOTAL PAYABLE (NET OF TDS)', 'PAID', 'OUTSTANDING', 'OPEN INVOICES', 'GST ON INVOICES', 'TDS TO DEPOSIT'],
            [
                stats.kpi.total_payable,
                stats.kpi.total_paid,
                stats.kpi.total_outstanding,
                stats.kpi.open_invoices,
                stats.kpi.total_gst,
                stats.kpi.total_tds
            ],
            [
                `Invoice value ₹${stats.kpi.invoice_value.toLocaleString('en-IN')}`,
                stats.kpi.paid_percent + ' of payable',
                stats.kpi.outstanding_percent + ' of payable',
                `${stats.kpi.awaiting_invoice_count} awaiting invoice`,
                'Input credit to be matched',
                'Deducted from vendor payables'
            ],
            [],
            ['PAYMENT STATUS BREAKDOWN'],
            ['STATUS', 'INVOICES', 'PAYABLE', 'PAID', 'OUTSTANDING', '% OF OUTST.'],
            ...stats.status_breakdown.map(s => [
                s.status,
                s.invoices,
                parseFloat(s.payable),
                parseFloat(s.paid),
                parseFloat(s.outstanding),
                s.percent_outst
            ]),
            [],
            ['SITE-WISE POSITION'],
            ['SITE', 'INVOICES', 'PAYABLE', 'PAID', 'OUTSTANDING', '% PAID'],
            ...stats.site_positions.map(s => [
                s.site_name,
                s.invoices,
                parseFloat(s.payable),
                parseFloat(s.paid),
                parseFloat(s.outstanding),
                s.percent_paid
            ])
        ];
        const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
        xlsx.utils.book_append_sheet(wb, wsSummary, 'Dashboard');

        // Sheet 2: All Invoices Register
        const registerHeaders = [
            'Invoice ID', 'Site Name', 'Vendor Name', 'Invoice Number', 'Invoice Date',
            'PO Number', 'Category', 'Basic Amount', 'GST (18%)', 'TDS (2%)',
            'Invoice Value', 'Net Payable', 'Paid Amount', 'Outstanding', 'Status',
            'Payment Mode', 'Last UTR / Ref', 'Remarks'
        ];
        const registerData = [
            registerHeaders,
            ...allInvoices.map(inv => [
                inv.invoice_id,
                inv.site_name,
                inv.vendor_name,
                inv.invoice_number,
                inv.invoice_date,
                inv.po_number || '—',
                inv.category,
                parseFloat(inv.basic_amount || 0),
                parseFloat(inv.gst_amount || 0),
                parseFloat(inv.tds_amount || 0),
                parseFloat(inv.invoice_value || 0),
                parseFloat(inv.total_payable || 0),
                parseFloat(inv.paid_amount || 0),
                parseFloat(inv.outstanding_amount || 0),
                inv.status,
                inv.last_payment_mode || '—',
                inv.last_transaction_ref || '—',
                inv.remarks || '—'
            ])
        ];
        const wsRegister = xlsx.utils.aoa_to_sheet(registerData);
        xlsx.utils.book_append_sheet(wb, wsRegister, 'Vendor Payment Tracker');

        // Sheet 3: Outstanding Payments
        const openInvoices = allInvoices.filter(i => i.status === 'OUTSTANDING' || i.status === 'PART_PAID');
        const openData = [
            registerHeaders,
            ...openInvoices.map(inv => [
                inv.invoice_id,
                inv.site_name,
                inv.vendor_name,
                inv.invoice_number,
                inv.invoice_date,
                inv.po_number || '—',
                inv.category,
                parseFloat(inv.basic_amount || 0),
                parseFloat(inv.gst_amount || 0),
                parseFloat(inv.tds_amount || 0),
                parseFloat(inv.invoice_value || 0),
                parseFloat(inv.total_payable || 0),
                parseFloat(inv.paid_amount || 0),
                parseFloat(inv.outstanding_amount || 0),
                inv.status,
                inv.last_payment_mode || '—',
                inv.last_transaction_ref || '—',
                inv.remarks || '—'
            ])
        ];
        const wsOpen = xlsx.utils.aoa_to_sheet(openData);
        xlsx.utils.book_append_sheet(wb, wsOpen, 'Outstanding Payments');

        return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
};

module.exports = vendorPaymentService;
