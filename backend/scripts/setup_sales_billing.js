const db = require('../config/database');

async function setupSalesBilling() {
    console.log('🚀 Setting up Sales Billing Schema & Seeding Invoices...');

    // 1. Add missing columns to invoices table
    await db.query(`
        ALTER TABLE invoices 
        ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS po_date DATE,
        ADD COLUMN IF NOT EXISTS ra_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS received_in_bank NUMERIC(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bank_received_date DATE,
        ADD COLUMN IF NOT EXISTS transfer_date DATE,
        ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(15,2) DEFAULT 0;
    `);
    console.log('✅ Altered invoices table with PO, RA, Bank Realization, and Retention columns.');

    // 2. Ensure Clients exist
    // Client 1: Siemens Ltd
    let siemens = await db.query("SELECT * FROM clients WHERE LOWER(client_name) LIKE '%siemens ltd%' LIMIT 1");
    let siemensId;
    if (siemens.rows.length === 0) {
        const ins = await db.query(`
            INSERT INTO clients (client_code, client_name, company_name, is_active)
            VALUES ('CL-SIEMENS', 'Siemens Ltd', 'Siemens Limited', TRUE)
            RETURNING client_id
        `);
        siemensId = ins.rows[0].client_id;
        console.log('✅ Created Client: Siemens Ltd (ID:', siemensId, ')');
    } else {
        siemensId = siemens.rows[0].client_id;
        console.log('ℹ️ Found Client: Siemens Ltd (ID:', siemensId, ')');
    }

    // Client 2: Siemens Energy India Ltd
    let siemensEnergy = await db.query("SELECT * FROM clients WHERE LOWER(client_name) LIKE '%siemens energy%' LIMIT 1");
    let siemensEnergyId;
    if (siemensEnergy.rows.length === 0) {
        const ins = await db.query(`
            INSERT INTO clients (client_code, client_name, company_name, is_active)
            VALUES ('CL-SIEMENS-ENG', 'Siemens Energy India Ltd', 'Siemens Energy India Limited', TRUE)
            RETURNING client_id
        `);
        siemensEnergyId = ins.rows[0].client_id;
        console.log('✅ Created Client: Siemens Energy India Ltd (ID:', siemensEnergyId, ')');
    } else {
        siemensEnergyId = siemensEnergy.rows[0].client_id;
        console.log('ℹ️ Found Client: Siemens Energy India Ltd (ID:', siemensEnergyId, ')');
    }

    // 3. Resolve Sites
    // Lumina HT Panel -> site_id: 5 (GTPL LUMINA Data Center)
    let luminaSite = await db.query("SELECT site_id FROM sites WHERE site_code = 'GTPL-LUMINA' OR site_name ILIKE '%Lumina%' LIMIT 1");
    const luminaSiteId = luminaSite.rows[0]?.site_id || 5;

    // CGPL Mundra -> site_id: 15 (TATA CGPL)
    let cgplSite = await db.query("SELECT site_id FROM sites WHERE site_code = 'TATA-CGPL' OR site_name ILIKE '%CGPL%' LIMIT 1");
    const cgplSiteId = cgplSite.rows[0]?.site_id || 15;

    // 4. Seed Invoice 1: NKD/26-27/001
    // SN 1: Siemens Ltd | Lumina HT Panel | PO: 4513883559 | 20-Mar-26 | RA-01 | NKD/26-27/001 | 1-Apr-26 | Apr-26
    // Basic: 574,844.00 | GST: 103,471.92 | Total: 678,315.92 | TDS: 11,496.88 | Final: 666,819.04 | Received: 666,819.04 | Date: 12-May-26 | Retention: 0.00
    await db.query(`
        INSERT INTO invoices (
            invoice_number, client_id, site_id, billing_month, billing_year,
            po_number, po_date, ra_number,
            subtotal, cgst, sgst, igst, tax_amount, total_amount,
            tds_rate, tds_amount, net_receivable,
            received_in_bank, bank_received_date, retention_amount,
            status, issue_date, due_date, paid_date, notes
        ) VALUES (
            'NKD/26-27/001', $1, $2, 4, 2026,
            '4513883559', '2026-03-20', 'RA-01',
            574844.00, 51735.96, 51735.96, 0, 103471.92, 678315.92,
            2.00, 11496.88, 666819.04,
            666819.04, '2026-05-12', 0.00,
            'PAID', '2026-04-01', '2026-05-15', '2026-05-12', 'Lumina HT Panel RA-01 Siemens Billing'
        )
        ON CONFLICT (invoice_number) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            site_id = EXCLUDED.site_id,
            po_number = EXCLUDED.po_number,
            po_date = EXCLUDED.po_date,
            ra_number = EXCLUDED.ra_number,
            subtotal = EXCLUDED.subtotal,
            tax_amount = EXCLUDED.tax_amount,
            total_amount = EXCLUDED.total_amount,
            tds_rate = EXCLUDED.tds_rate,
            tds_amount = EXCLUDED.tds_amount,
            net_receivable = EXCLUDED.net_receivable,
            received_in_bank = EXCLUDED.received_in_bank,
            bank_received_date = EXCLUDED.bank_received_date,
            retention_amount = EXCLUDED.retention_amount,
            status = EXCLUDED.status,
            issue_date = EXCLUDED.issue_date,
            paid_date = EXCLUDED.paid_date,
            notes = EXCLUDED.notes
    `, [siemensId, luminaSiteId]);
    console.log('✅ Upserted Invoice: NKD/26-27/001 (Siemens Ltd - Lumina HT Panel)');

    // 5. Seed Invoice 2: NKD/26-27/002
    // SN 2: Siemens Energy India Ltd | CGPL Mundra | PO: 4513467341 | 24-Apr-25 | RA-06 | NKD/26-27/002 | 2-Apr-26 | Apr-26
    // Basic: 413,280.00 | GST: 74,390.40 | Total: 487,670.40 | TDS: 8,265.60 | Final: 479,404.80 | Received: 479,404.80 | Date: 19-May-26 | Retention: 0.00
    await db.query(`
        INSERT INTO invoices (
            invoice_number, client_id, site_id, billing_month, billing_year,
            po_number, po_date, ra_number,
            subtotal, cgst, sgst, igst, tax_amount, total_amount,
            tds_rate, tds_amount, net_receivable,
            received_in_bank, bank_received_date, retention_amount,
            status, issue_date, due_date, paid_date, notes
        ) VALUES (
            'NKD/26-27/002', $1, $2, 4, 2026,
            '4513467341', '2025-04-24', 'RA-06',
            413280.00, 37195.20, 37195.20, 0, 74390.40, 487670.40,
            2.00, 8265.60, 479404.80,
            479404.80, '2026-05-19', 0.00,
            'PAID', '2026-04-02', '2026-05-15', '2026-05-19', 'CGPL Mundra RA-06 Siemens Energy Billing'
        )
        ON CONFLICT (invoice_number) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            site_id = EXCLUDED.site_id,
            po_number = EXCLUDED.po_number,
            po_date = EXCLUDED.po_date,
            ra_number = EXCLUDED.ra_number,
            subtotal = EXCLUDED.subtotal,
            tax_amount = EXCLUDED.tax_amount,
            total_amount = EXCLUDED.total_amount,
            tds_rate = EXCLUDED.tds_rate,
            tds_amount = EXCLUDED.tds_amount,
            net_receivable = EXCLUDED.net_receivable,
            received_in_bank = EXCLUDED.received_in_bank,
            bank_received_date = EXCLUDED.bank_received_date,
            retention_amount = EXCLUDED.retention_amount,
            status = EXCLUDED.status,
            issue_date = EXCLUDED.issue_date,
            paid_date = EXCLUDED.paid_date,
            notes = EXCLUDED.notes
    `, [siemensEnergyId, cgplSiteId]);
    console.log('✅ Upserted Invoice: NKD/26-27/002 (Siemens Energy India Ltd - CGPL Mundra)');

    // 6. Summary verification
    const res = await db.query(`
        SELECT 
            count(*) as count,
            sum(subtotal) as total_basic,
            sum(tax_amount) as total_gst,
            sum(total_amount) as total_gross,
            sum(tds_amount) as total_tds,
            sum(net_receivable) as total_net,
            sum(received_in_bank) as total_received
        FROM invoices
    `);
    console.log('\n=============================================');
    console.log('🎉 SALES BILLING REGISTER VERIFICATION:');
    console.table(res.rows[0]);
    console.log('=============================================\n');

    process.exit(0);
}

setupSalesBilling().catch(err => {
    console.error('❌ Setup failed:', err);
    process.exit(1);
});
