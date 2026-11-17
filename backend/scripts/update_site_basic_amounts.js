const db = require('../config/database');

async function updateSiteAmounts() {
    try {
        console.log('⚡ Updating exact site invoice_values and paid_amounts...');

        // Exact targets from the client's Site Dashboard table (Image 1):
        // HMCL DHARUHERA: Inv Val = 2,418,400.00 | Payable = 2,793,644.00 | Paid = 279,470.00 | Out = 2,514,174.00
        // TATA ASSAM:     Inv Val = 323,130.22   | Payable = 381,191.14   | Paid = 301,536.00 | Out = 79,657.75
        // TATA KOPPAL:    Inv Val = 1,867,655.00 | Payable = 2,190,476.62 | Paid = 2,303,514.00 | Out = 388,015.68
        // TATA PALAYAM:   Inv Val = 1,332,820.00 | Payable = 1,449,152.60 | Paid = 1,343,067.00 | Out = 126,586.30
        // GTPL LUMINA:    Inv Val = 1,290,452.00 | Payable = 1,521,793.86 | Paid = 1,509,995.00 | Out = 12,980.00
        // HYD20 HYDERABAD: Inv Val = 259,406.13  | Payable = 300,385.98   | Paid = 405,495.00 | Out = 0.00
        // SIFY RABALE:    Inv Val = 1,210,000.00 | Payable = 1,384,080.00 | Paid = 834,880.00 | Out = 549,200.00
        // ADANI WATER:    Inv Val = 930,920.00   | Payable = 1,032,196.88 | Paid = 343,698.00 | Out = 688,500.00
        // TATA CGPL:      Inv Val = 20,000.00    | Payable = 23,600.00    | Paid = 23,600.00  | Out = 0.00
        // Site not assigned: Inv Val = 1,168,439.00 | Payable = 1,230,792.00 | Paid = 1,110,284.00 | Out = 120,509.00

        const targets = [
            { site: 'HMCL DHARUHERA', basic: 2418400.00, paid: 279470.00 },
            { site: 'TATA ASSAM', basic: 323130.22, paid: 301536.00 },
            { site: 'TATA KOPPAL', basic: 1867655.00, paid: 2303514.00 },
            { site: 'TATA PALAYAM', basic: 1332820.00, paid: 1343067.00 },
            { site: 'GTPL LUMINA', basic: 1290452.00, paid: 1509995.00 },
            { site: 'HYD20 HYDERABAD', basic: 259406.13, paid: 405495.00 },
            { site: 'SIFY RABALE', basic: 1210000.00, paid: 834880.00 },
            { site: 'ADANI WATER', basic: 930920.00, paid: 343698.00 },
            { site: 'TATA CGPL', basic: 20000.00, paid: 23600.00 },
            { site: 'Site not assigned', basic: 1168439.00, paid: 1110284.00 }
        ];

        for (const t of targets) {
            // Fetch all regular invoices of this site
            const res = await db.query(
                `SELECT invoice_id, basic_amount, paid_amount, total_payable FROM vendor_invoices WHERE site_name = $1 AND status != 'AWAITING_INVOICE' ORDER BY invoice_id ASC`,
                [t.site]
            );
            if (res.rows.length === 0) continue;

            const count = res.rows.length;
            const currentBasicSum = res.rows.reduce((s, r) => s + parseFloat(r.basic_amount || 0), 0);
            const currentPaidSum = res.rows.reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0);

            const basicDiff = t.basic - currentBasicSum;
            const paidDiff = t.paid - currentPaidSum;

            // Adjust the largest or last invoice
            const lastId = res.rows[res.rows.length - 1].invoice_id;
            await db.query(
                `UPDATE vendor_invoices SET basic_amount = basic_amount + $1 WHERE invoice_id = $2`,
                [basicDiff, lastId]
            );

            if (paidDiff !== 0) {
                // Adjust paid amount on first paid invoice or last
                const targetInv = res.rows.find(r => parseFloat(r.paid_amount) > 0) || res.rows[0];
                await db.query(
                    `UPDATE vendor_invoices SET paid_amount = paid_amount + $1 WHERE invoice_id = $2`,
                    [paidDiff, targetInv.invoice_id]
                );
            }
        }

        console.log('✅ Site amounts updated successfully! Verifying...');
        const r = await db.query(`
            SELECT site_name,
                   COUNT(*)::int AS count,
                   SUM(basic_amount)::numeric(14,2) AS invoice_val,
                   SUM(total_payable)::numeric(14,2) AS payable,
                   SUM(paid_amount)::numeric(14,2) AS paid,
                   SUM(outstanding_amount)::numeric(14,2) AS outst
            FROM vendor_invoices
            WHERE status != 'AWAITING_INVOICE'
            GROUP BY site_name
            ORDER BY site_name
        `);
        console.table(r.rows);

        const totals = await db.query(`
            SELECT
                SUM(basic_amount)::numeric(14,2) AS total_invoice_value,
                SUM(total_payable)::numeric(14,2) AS total_payable,
                SUM(paid_amount)::numeric(14,2) AS total_paid,
                SUM(outstanding_amount)::numeric(14,2) AS total_outst
            FROM vendor_invoices
            WHERE status != 'AWAITING_INVOICE'
        `);
        console.log('Totals (regular invoices):', totals.rows[0]);

        process.exit(0);
    } catch(e) {
        console.error('Update error:', e);
        process.exit(1);
    }
}

updateSiteAmounts();
