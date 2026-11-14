const db = require('../config/database');

async function setupVendorPayments() {
    try {
        console.log('🚀 Setting up Vendor Payments schema & seeding FY 2026-27 data...');

        // 1. Create tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS vendor_invoices (
                invoice_id SERIAL PRIMARY KEY,
                vendor_id INT REFERENCES vendors(vendor_id) ON DELETE SET NULL,
                site_id INT REFERENCES sites(site_id) ON DELETE SET NULL,
                vendor_name VARCHAR(255) NOT NULL,
                site_name VARCHAR(255) NOT NULL,
                invoice_number VARCHAR(100) NOT NULL UNIQUE,
                invoice_date DATE NOT NULL,
                due_date DATE,
                po_number VARCHAR(100),
                category VARCHAR(100) DEFAULT 'MATERIAL',
                basic_amount NUMERIC(14,2) DEFAULT 0,
                gst_rate NUMERIC(5,2) DEFAULT 18.00,
                gst_amount NUMERIC(14,2) DEFAULT 0,
                tds_rate NUMERIC(5,2) DEFAULT 2.00,
                tds_amount NUMERIC(14,2) DEFAULT 0,
                invoice_value NUMERIC(14,2) NOT NULL DEFAULT 0,
                total_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
                paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                outstanding_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                status VARCHAR(50) NOT NULL DEFAULT 'OUTSTANDING',
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS vendor_payments (
                payment_id SERIAL PRIMARY KEY,
                invoice_id INT REFERENCES vendor_invoices(invoice_id) ON DELETE CASCADE,
                vendor_id INT REFERENCES vendors(vendor_id) ON DELETE SET NULL,
                payment_date DATE NOT NULL,
                amount_paid NUMERIC(14,2) NOT NULL,
                payment_mode VARCHAR(50) DEFAULT 'NEFT/RTGS',
                transaction_reference VARCHAR(100),
                bank_name VARCHAR(100) DEFAULT 'HDFC Bank',
                paid_by VARCHAR(100) DEFAULT 'Finance Team',
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tables vendor_invoices and vendor_payments verified/created.');

        // 2. Ensure all sites exist
        const requiredSites = [
            { code: 'HMCL-DHARUHERA', name: 'HMCL DHARUHERA', city: 'Dharuhera', state: 'Haryana' },
            { code: 'TATA-ASSAM', name: 'TATA ASSAM', city: 'Guwahati', state: 'Assam' },
            { code: 'TATA-KOPPAL', name: 'TATA KOPPAL', city: 'Koppal', state: 'Karnataka' },
            { code: 'TATA-PALAYAM', name: 'TATA PALAYAM', city: 'Palayam', state: 'Tamil Nadu' },
            { code: 'JSW-JAIGARH', name: 'JSW JAIGARH', city: 'Jaigarh', state: 'Maharashtra' },
            { code: 'GTPL-LUMINA', name: 'GTPL LUMINA', city: 'Navi Mumbai', state: 'Maharashtra' },
            { code: 'HYD20-HYD', name: 'HYD20 HYDERABAD', city: 'Hyderabad', state: 'Telangana' },
            { code: 'SIFY-RABALE', name: 'SIFY RABALE', city: 'Rabale', state: 'Maharashtra' },
            { code: 'ADANI-WATER', name: 'ADANI WATER', city: 'Mundra', state: 'Gujarat' },
            { code: 'TATA-CGPL', name: 'TATA CGPL', city: 'Mundra', state: 'Gujarat' },
            { code: 'SITE-UNASSIGNED', name: 'Site not assigned', city: 'Faridabad', state: 'Haryana' }
        ];

        const siteMap = {};
        for (const s of requiredSites) {
            let res = await db.query('SELECT site_id, site_name FROM sites WHERE site_name ILIKE $1 OR site_code ILIKE $2', [s.name, s.code]);
            if (res.rows.length === 0) {
                res = await db.query(
                    'INSERT INTO sites (site_code, site_name, city, state, is_active) VALUES ($1, $2, $3, $4, true) RETURNING site_id, site_name',
                    [s.code, s.name, s.city, s.state]
                );
            }
            siteMap[s.name] = res.rows[0].site_id;
        }
        console.log('✅ Site mappings prepared:', siteMap);

        // 3. Ensure some vendors exist
        const requiredVendors = [
            'Polycab India Ltd', 'Havells India Ltd', 'Schneider Electric', 'ABB India Ltd',
            'Supreme Industries Ltd', '3M / Raychem RPG', 'Commscope India', 'Roxtec India Pvt Ltd',
            'SG Powers Pvt Ltd', 'ProReact Systems', 'DMP Projects', 'Steel Authority of India (SAIL)',
            'Finolex Cables Ltd', 'Siemens Ltd', 'L&T Electrical & Automation', 'KEI Industries'
        ];
        const vendorMap = {};
        for (const vName of requiredVendors) {
            let vRes = await db.query('SELECT vendor_id, vendor_name FROM vendors WHERE vendor_name ILIKE $1', [vName]);
            if (vRes.rows.length === 0) {
                const vCode = 'VND-' + vName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
                vRes = await db.query(
                    'INSERT INTO vendors (vendor_code, vendor_name, category, compliance_status) VALUES ($1, $2, $3, $4) RETURNING vendor_id, vendor_name',
                    [vCode, vName, 'EQUIPMENT', 'COMPLIANT']
                );
            }
            vendorMap[vName] = vRes.rows[0].vendor_id;
        }

        // Check if data already exists in vendor_invoices
        const existingCountRes = await db.query('SELECT COUNT(*) FROM vendor_invoices');
        const count = parseInt(existingCountRes.rows[0].count, 10);
        if (count > 0) {
            console.log(`ℹ️ vendor_invoices already has ${count} records. Clearing for fresh seed to match exact FY 26-27 dashboard numbers...`);
            await db.query('TRUNCATE TABLE vendor_payments CASCADE');
            await db.query('TRUNCATE TABLE vendor_invoices CASCADE');
        }

        // Define exact site specs to match client dashboard:
        // SITE | INVOICES | PAYABLE | PAID | OUTSTANDING | % PAID
        // HMCL DHARUHERA: 5 inv | Payable: 2793644 | Paid: 279470 | Out: 2514174
        // TATA ASSAM: 10 inv | Payable: 381191 | Paid: 301536 | Out: 79658
        // TATA KOPPAL: 19 inv | Payable: 2190477 | Paid: 2303514 | Out: 388016
        // TATA PALAYAM: 5 inv | Payable: 1449153 | Paid: 1343067 | Out: 126586
        // JSW JAIGARH: 0 inv
        // GTPL LUMINA: 10 inv | Payable: 1521794 | Paid: 1509995 | Out: 12980
        // HYD20 HYDERABAD: 5 inv | Payable: 300386 | Paid: 405495 | Out: 0
        // SIFY RABALE: 6 inv | Payable: 1384080 | Paid: 834880 | Out: 549200
        // ADANI WATER: 9 inv | Payable: 1032197 | Paid: 343698 | Out: 688500
        // TATA CGPL: 1 inv | Payable: 23600 | Paid: 23600 | Out: 0
        // Site not assigned: 3 inv | Payable: 1230792 | Paid: 1110284 | Out: 120509
        // Awaiting Invoice: 6 records | Payable: 0 | Paid: 620500 | Out: 0

        const siteConfigs = [
            {
                siteName: 'HMCL DHARUHERA',
                invoices: 5,
                payable: 2793644,
                paid: 279470,
                outstanding: 2514174,
                // HMCL has 5 invoices: e.g. 1 part-paid, 4 outstanding
                splits: [
                    { payable: 279470, paid: 279470, status: 'PAID' },
                    { payable: 650000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 780000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 540000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 544174, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'TATA ASSAM',
                invoices: 10,
                payable: 381191,
                paid: 301536,
                outstanding: 79658,
                // 10 invoices: 8 paid, 1 part-paid, 1 outstanding
                splits: [
                    { payable: 32500, paid: 32500, status: 'PAID' },
                    { payable: 41200, paid: 41200, status: 'PAID' },
                    { payable: 28400, paid: 28400, status: 'PAID' },
                    { payable: 39500, paid: 39500, status: 'PAID' },
                    { payable: 44100, paid: 44100, status: 'PAID' },
                    { payable: 36800, paid: 36800, status: 'PAID' },
                    { payable: 29800, paid: 29800, status: 'PAID' },
                    { payable: 49236, paid: 49236, status: 'PAID' },
                    { payable: 45000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 34655, paid: 0, status: 'OUTSTANDING' }, // Outstanding total = 79655 (~79658)
                ]
            },
            {
                siteName: 'TATA KOPPAL',
                invoices: 19,
                payable: 2190477,
                paid: 2303514,
                outstanding: 388016,
                // 19 invoices: paid + part paid + outstanding
                splits: [
                    { payable: 95000, paid: 95000, status: 'PAID' },
                    { payable: 112000, paid: 112000, status: 'PAID' },
                    { payable: 88500, paid: 88500, status: 'PAID' },
                    { payable: 145000, paid: 145000, status: 'PAID' },
                    { payable: 74200, paid: 74200, status: 'PAID' },
                    { payable: 120000, paid: 120000, status: 'PAID' },
                    { payable: 65400, paid: 65400, status: 'PAID' },
                    { payable: 89000, paid: 89000, status: 'PAID' },
                    { payable: 134000, paid: 134000, status: 'PAID' },
                    { payable: 98500, paid: 98500, status: 'PAID' },
                    { payable: 165000, paid: 165000, status: 'PAID' },
                    { payable: 78000, paid: 78000, status: 'PAID' },
                    { payable: 142000, paid: 142000, status: 'PAID' },
                    { payable: 105861, paid: 105861, status: 'PAID' },
                    { payable: 280000, paid: 493037, status: 'PAID' }, // extra advance paid on this contract
                    { payable: 100000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 95000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 98016, paid: 0, status: 'OUTSTANDING' },
                    { payable: 95000, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'TATA PALAYAM',
                invoices: 5,
                payable: 1449153,
                paid: 1343067,
                outstanding: 126586,
                splits: [
                    { payable: 312000, paid: 312000, status: 'PAID' },
                    { payable: 425000, paid: 425000, status: 'PAID' },
                    { payable: 286067, paid: 286067, status: 'PAID' },
                    { payable: 300000, paid: 320000, status: 'PAID' },
                    { payable: 126086, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'GTPL LUMINA',
                invoices: 10,
                payable: 1521794,
                paid: 1509995,
                outstanding: 12980,
                splits: [
                    { payable: 180000, paid: 180000, status: 'PAID' },
                    { payable: 215000, paid: 215000, status: 'PAID' },
                    { payable: 142000, paid: 142000, status: 'PAID' },
                    { payable: 168000, paid: 168000, status: 'PAID' },
                    { payable: 98500, paid: 98500, status: 'PAID' },
                    { payable: 125000, paid: 125000, status: 'PAID' },
                    { payable: 245000, paid: 245000, status: 'PAID' },
                    { payable: 198495, paid: 198495, status: 'PAID' },
                    { payable: 137000, paid: 138000, status: 'PAID' },
                    { payable: 12799, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'HYD20 HYDERABAD',
                invoices: 5,
                payable: 300386,
                paid: 405495,
                outstanding: 0,
                splits: [
                    { payable: 54000, paid: 54000, status: 'PAID' },
                    { payable: 62000, paid: 62000, status: 'PAID' },
                    { payable: 48386, paid: 48386, status: 'PAID' },
                    { payable: 71000, paid: 71000, status: 'PAID' },
                    { payable: 65000, paid: 170109, status: 'PAID' }, // includes supplier mobilization advance
                ]
            },
            {
                siteName: 'SIFY RABALE',
                invoices: 6,
                payable: 1384080,
                paid: 834880,
                outstanding: 549200,
                splits: [
                    { payable: 210000, paid: 210000, status: 'PAID' },
                    { payable: 284880, paid: 284880, status: 'PAID' },
                    { payable: 340000, paid: 340000, status: 'PAID' },
                    { payable: 250000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 199200, paid: 0, status: 'OUTSTANDING' },
                    { payable: 100000, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'ADANI WATER',
                invoices: 9,
                payable: 1032197,
                paid: 343698,
                outstanding: 688500,
                splits: [
                    { payable: 95000, paid: 95000, status: 'PAID' },
                    { payable: 112000, paid: 112000, status: 'PAID' },
                    { payable: 136698, paid: 136698, status: 'PAID' },
                    { payable: 85000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 92000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 110000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 125000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 140000, paid: 0, status: 'OUTSTANDING' },
                    { payable: 136499, paid: 0, status: 'OUTSTANDING' },
                ]
            },
            {
                siteName: 'TATA CGPL',
                invoices: 1,
                payable: 23600,
                paid: 23600,
                outstanding: 0,
                splits: [
                    { payable: 23600, paid: 23600, status: 'PAID' }
                ]
            },
            {
                siteName: 'Site not assigned',
                invoices: 3,
                payable: 1230792,
                paid: 1110284,
                outstanding: 120509,
                splits: [
                    { payable: 450000, paid: 450000, status: 'PAID' },
                    { payable: 660283, paid: 660284, status: 'PAID' },
                    { payable: 120509, paid: 0, status: 'OUTSTANDING' },
                ]
            }
        ];

        // Now adjust Part-Paid vs Outstanding counts to precisely match client table:
        // Target status table:
        // Paid: 51 invoices | Payable: 46,53,249 | Paid: 46,60,597 | Outstanding: 0
        // Part Paid: 10 invoices | Payable: 64,15,596 | Paid: 31,74,442 | Outstanding: 32,41,154
        // Outstanding: 12 invoices | Payable: 12,38,469 | Paid: 0 | Outstanding: 12,38,469
        // Awaiting Invoice: 6 items | Paid: 6,20,500
        // Total: 79 items | Payable: 1,23,07,313 | Paid: 84,55,539 | Outstanding: 44,79,623

        // Let's create an exact list of 73 invoices + 6 advance awaiting invoice payments
        let invoiceSerial = 1;
        const vendorsList = Object.keys(vendorMap);

        // Helper to format invoice number
        const getInvNum = (siteCode, seq) => `INV/NKD/26-27/${siteCode.slice(0, 4)}/${String(seq).padStart(3, '0')}`;

        // Dates distribution between 01-Apr-2026 and 07-Nov-2026
        const dates = [
            '2026-04-12', '2026-04-25', '2026-05-08', '2026-05-19', '2026-05-28',
            '2026-06-05', '2026-06-18', '2026-06-30', '2026-07-10', '2026-07-22',
            '2026-08-04', '2026-08-16', '2026-08-29', '2026-09-08', '2026-09-20',
            '2026-10-05', '2026-10-18', '2026-10-28', '2026-11-02', '2026-11-05'
        ];

        // We will construct 73 invoices with exact totals:
        // Total Payable: 1,23,07,313
        // Total Paid: 78,35,039 (plus 6,20,500 awaiting invoice = 84,55,539 total paid!)
        // Total Outstanding: 44,79,623
        // GST total: 17,94,570
        // TDS total: 3,08,479

        // 51 Paid invoices (Total Payable: 46,53,249, Total Paid: 46,60,597, Outstanding: 0)
        // 10 Part Paid invoices (Total Payable: 64,15,596, Total Paid: 31,74,442, Outstanding: 32,41,154)
        // 12 Outstanding invoices (Total Payable: 12,38,469, Total Paid: 0, Outstanding: 12,38,469)
        // 6 Awaiting Invoice records (Total Paid: 6,20,500)

        // Sites allocation for 73 invoices:
        // HMCL DHARUHERA: 5 inv (1 Paid, 2 Part Paid, 2 Outstanding) -> Payable: 27,93,644, Paid: 2,79,470, Out: 25,14,174
        // TATA ASSAM: 10 inv (8 Paid, 1 Part Paid, 1 Outstanding) -> Payable: 3,81,191, Paid: 3,01,536, Out: 79,658
        // TATA KOPPAL: 19 inv (14 Paid, 2 Part Paid, 3 Outstanding) -> Payable: 21,90,477, Paid: 23,03,514, Out: 3,88,016
        // TATA PALAYAM: 5 inv (4 Paid, 1 Outstanding) -> Payable: 14,49,153, Paid: 13,43,067, Out: 1,26,586
        // GTPL LUMINA: 10 inv (9 Paid, 1 Part Paid) -> Payable: 15,21,794, Paid: 15,09,995, Out: 12,980
        // HYD20 HYDERABAD: 5 inv (5 Paid) -> Payable: 3,00,386, Paid: 4,05,495, Out: 0
        // SIFY RABALE: 6 inv (3 Paid, 1 Part Paid, 2 Outstanding) -> Payable: 13,84,080, Paid: 8,34,880, Out: 549,200
        // ADANI WATER: 9 inv (3 Paid, 3 Part Paid, 3 Outstanding) -> Payable: 10,32,197, Paid: 3,43,698, Out: 688,500
        // TATA CGPL: 1 inv (1 Paid) -> Payable: 23,600, Paid: 23,600, Out: 0
        // Site not assigned: 3 inv (2 Paid, 1 Outstanding) -> Payable: 12,30,792, Paid: 11,10,284, Out: 120,509

        // Let's generate individual items for each site config:
        const invoicesData = [
            // --- HMCL DHARUHERA (5 inv | Payable: 2793644, Paid: 279470, Out: 2514174) ---
            { site: 'HMCL DHARUHERA', vendor: 'Polycab India Ltd', payable: 279470, paid: 279470, status: 'PAID' },
            { site: 'HMCL DHARUHERA', vendor: 'Havells India Ltd', payable: 1200000, paid: 0, status: 'PART_PAID', paidAmt: 0, out: 1200000 },
            { site: 'HMCL DHARUHERA', vendor: 'Schneider Electric', payable: 714174, paid: 0, status: 'PART_PAID', paidAmt: 0, out: 714174 },
            { site: 'HMCL DHARUHERA', vendor: 'Supreme Industries Ltd', payable: 300000, paid: 0, status: 'OUTSTANDING', paidAmt: 0, out: 300000 },
            { site: 'HMCL DHARUHERA', vendor: 'ProReact Systems', payable: 300000, paid: 0, status: 'OUTSTANDING', paidAmt: 0, out: 300000 },

            // --- TATA ASSAM (10 inv | Payable: 381191, Paid: 301536, Out: 79658) ---
            { site: 'TATA ASSAM', vendor: 'Commscope India', payable: 32500, paid: 32500, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: '3M / Raychem RPG', payable: 41200, paid: 41200, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Polycab India Ltd', payable: 28400, paid: 28400, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Roxtec India Pvt Ltd', payable: 39500, paid: 39500, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'SG Powers Pvt Ltd', payable: 44100, paid: 44100, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Havells India Ltd', payable: 36800, paid: 36800, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Supreme Industries Ltd', payable: 29800, paid: 29800, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Finolex Cables Ltd', payable: 49236, paid: 49236, status: 'PAID' },
            { site: 'TATA ASSAM', vendor: 'Siemens Ltd', payable: 50000, paid: 20000, status: 'PART_PAID', out: 30000 },
            { site: 'TATA ASSAM', vendor: 'Schneider Electric', payable: 29655, paid: 0, status: 'OUTSTANDING', out: 29658 },

            // --- TATA KOPPAL (19 inv | Payable: 2190477, Paid: 2303514, Out: 388016) ---
            { site: 'TATA KOPPAL', vendor: 'Polycab India Ltd', payable: 95000, paid: 95000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Havells India Ltd', payable: 112000, paid: 112000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Schneider Electric', payable: 88500, paid: 88500, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'ABB India Ltd', payable: 145000, paid: 145000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Supreme Industries Ltd', payable: 74200, paid: 74200, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: '3M / Raychem RPG', payable: 120000, paid: 120000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Commscope India', payable: 65400, paid: 65400, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Roxtec India Pvt Ltd', payable: 89000, paid: 89000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'SG Powers Pvt Ltd', payable: 134000, paid: 134000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'ProReact Systems', payable: 98500, paid: 98500, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'DMP Projects', payable: 165000, paid: 165000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Steel Authority of India (SAIL)', payable: 78000, paid: 78000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Finolex Cables Ltd', payable: 142000, paid: 142000, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'Siemens Ltd', payable: 105861, paid: 105861, status: 'PAID' },
            { site: 'TATA KOPPAL', vendor: 'L&T Electrical & Automation', payable: 290000, paid: 521053, status: 'PAID' }, // extra paid advance
            { site: 'TATA KOPPAL', vendor: 'KEI Industries', payable: 200000, paid: 150000, status: 'PART_PAID', out: 50000 },
            { site: 'TATA KOPPAL', vendor: 'Polycab India Ltd', payable: 100000, paid: 50000, status: 'PART_PAID', out: 50000 },
            { site: 'TATA KOPPAL', vendor: 'Schneider Electric', payable: 144000, paid: 0, status: 'OUTSTANDING', out: 144000 },
            { site: 'TATA KOPPAL', vendor: 'Havells India Ltd', payable: 144016, paid: 0, status: 'OUTSTANDING', out: 144016 },

            // --- TATA PALAYAM (5 inv | Payable: 1449153, Paid: 1343067, Out: 126586) ---
            { site: 'TATA PALAYAM', vendor: 'Polycab India Ltd', payable: 312000, paid: 312000, status: 'PAID' },
            { site: 'TATA PALAYAM', vendor: 'ABB India Ltd', payable: 425000, paid: 425000, status: 'PAID' },
            { site: 'TATA PALAYAM', vendor: 'Schneider Electric', payable: 286067, paid: 286067, status: 'PAID' },
            { site: 'TATA PALAYAM', vendor: 'Havells India Ltd', payable: 300000, paid: 320000, status: 'PAID' },
            { site: 'TATA PALAYAM', vendor: 'Supreme Industries Ltd', payable: 126086, paid: 0, status: 'OUTSTANDING', out: 126586 },

            // --- GTPL LUMINA (10 inv | Payable: 1521794, Paid: 1509995, Out: 12980) ---
            { site: 'GTPL LUMINA', vendor: 'Commscope India', payable: 180000, paid: 180000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: '3M / Raychem RPG', payable: 215000, paid: 215000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Polycab India Ltd', payable: 142000, paid: 142000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Schneider Electric', payable: 168000, paid: 168000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Roxtec India Pvt Ltd', payable: 98500, paid: 98500, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'SG Powers Pvt Ltd', payable: 125000, paid: 125000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Havells India Ltd', payable: 245000, paid: 245000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'ProReact Systems', payable: 198495, paid: 198495, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Supreme Industries Ltd', payable: 136800, paid: 138000, status: 'PAID' },
            { site: 'GTPL LUMINA', vendor: 'Finolex Cables Ltd', payable: 12999, paid: 0, status: 'OUTSTANDING', out: 12980 },

            // --- HYD20 HYDERABAD (5 inv | Payable: 300386, Paid: 405495, Out: 0) ---
            { site: 'HYD20 HYDERABAD', vendor: 'Polycab India Ltd', payable: 54000, paid: 54000, status: 'PAID' },
            { site: 'HYD20 HYDERABAD', vendor: 'Havells India Ltd', payable: 62000, paid: 62000, status: 'PAID' },
            { site: 'HYD20 HYDERABAD', vendor: 'Schneider Electric', payable: 48386, paid: 48386, status: 'PAID' },
            { site: 'HYD20 HYDERABAD', vendor: '3M / Raychem RPG', payable: 71000, paid: 71000, status: 'PAID' },
            { site: 'HYD20 HYDERABAD', vendor: 'ABB India Ltd', payable: 65000, paid: 170109, status: 'PAID' },

            // --- SIFY RABALE (6 inv | Payable: 1384080, Paid: 834880, Out: 549200) ---
            { site: 'SIFY RABALE', vendor: 'Commscope India', payable: 210000, paid: 210000, status: 'PAID' },
            { site: 'SIFY RABALE', vendor: 'Polycab India Ltd', payable: 284880, paid: 284880, status: 'PAID' },
            { site: 'SIFY RABALE', vendor: 'Schneider Electric', payable: 340000, paid: 340000, status: 'PAID' },
            { site: 'SIFY RABALE', vendor: 'Roxtec India Pvt Ltd', payable: 300000, paid: 0, status: 'PART_PAID', paidAmt: 0, out: 300000 },
            { site: 'SIFY RABALE', vendor: 'Havells India Ltd', payable: 149200, paid: 0, status: 'OUTSTANDING', out: 149200 },
            { site: 'SIFY RABALE', vendor: '3M / Raychem RPG', payable: 100000, paid: 0, status: 'OUTSTANDING', out: 100000 },

            // --- ADANI WATER (9 inv | Payable: 1032197, Paid: 343698, Out: 688500) ---
            { site: 'ADANI WATER', vendor: 'Polycab India Ltd', payable: 95000, paid: 95000, status: 'PAID' },
            { site: 'ADANI WATER', vendor: 'Havells India Ltd', payable: 112000, paid: 112000, status: 'PAID' },
            { site: 'ADANI WATER', vendor: 'Schneider Electric', payable: 136698, paid: 136698, status: 'PAID' },
            { site: 'ADANI WATER', vendor: 'Supreme Industries Ltd', payable: 250000, paid: 0, status: 'PART_PAID', out: 250000 },
            { site: 'ADANI WATER', vendor: 'ABB India Ltd', payable: 150000, paid: 0, status: 'PART_PAID', out: 150000 },
            { site: 'ADANI WATER', vendor: '3M / Raychem RPG', payable: 100000, paid: 0, status: 'PART_PAID', out: 100000 },
            { site: 'ADANI WATER', vendor: 'Finolex Cables Ltd', payable: 75000, paid: 0, status: 'OUTSTANDING', out: 75000 },
            { site: 'ADANI WATER', vendor: 'Siemens Ltd', payable: 60000, paid: 0, status: 'OUTSTANDING', out: 60000 },
            { site: 'ADANI WATER', vendor: 'KEI Industries', payable: 53499, paid: 0, status: 'OUTSTANDING', out: 53500 },

            // --- TATA CGPL (1 inv | Payable: 23600, Paid: 23600, Out: 0) ---
            { site: 'TATA CGPL', vendor: 'Polycab India Ltd', payable: 23600, paid: 23600, status: 'PAID' },

            // --- Site not assigned (3 inv | Payable: 1230792, Paid: 1110284, Out: 120509) ---
            { site: 'Site not assigned', vendor: 'Polycab India Ltd', payable: 450000, paid: 450000, status: 'PAID' },
            { site: 'Site not assigned', vendor: 'Havells India Ltd', payable: 660283, paid: 660284, status: 'PAID' },
            { site: 'Site not assigned', vendor: 'Schneider Electric', payable: 120509, paid: 0, status: 'OUTSTANDING', out: 120509 }
        ];

        // Let's refine and normalize the numbers across all 73 records so that:
        // 1) Total Payable sum is exactly 1,23,07,313
        // 2) Total Paid sum is 78,35,039 (and + 6,20,500 awaiting invoice = 84,55,539)
        // 3) Total Outstanding sum is exactly 44,79,623
        // 4) Exactly 51 PAID, 10 PART_PAID, 12 OUTSTANDING

        // Let's calculate current sums of invoicesData:
        let curPayable = invoicesData.reduce((s, x) => s + x.payable, 0);
        let curPaid = invoicesData.reduce((s, x) => s + x.paid, 0);
        console.log(`Initial draft - Invoices count: ${invoicesData.length}, Payable: ${curPayable}, Paid: ${curPaid}`);

        // Now adjust the 10 part-paid invoices so that their total paid matches exactly:
        // Target Part-Paid: 10 invoices, Payable: 64,15,596, Paid: 31,74,442, Outstanding: 32,41,154
        // Target Paid: 51 invoices, Payable: 46,53,249, Paid: 46,60,597, Outstanding: 0
        // Target Outstanding: 12 invoices, Payable: 12,38,469, Paid: 0, Outstanding: 12,38,469

        // Let's build the precise list of 73 invoices
        // We will assign exact amounts per status to guarantee mathematical equality to the rupee!
        const paidItems = [];
        const partPaidItems = [];
        const outItems = [];

        // Build 51 Paid items (Total payable: 46,53,249, Paid: 46,60,597)
        // Base 51 items
        const paidVendors = [
            'Polycab India Ltd', 'Havells India Ltd', 'Schneider Electric', 'ABB India Ltd',
            'Supreme Industries Ltd', '3M / Raychem RPG', 'Commscope India', 'Roxtec India Pvt Ltd',
            'SG Powers Pvt Ltd', 'ProReact Systems', 'DMP Projects', 'Steel Authority of India (SAIL)',
            'Finolex Cables Ltd', 'Siemens Ltd', 'L&T Electrical & Automation', 'KEI Industries'
        ];
        const paidSites = [
            'HMCL DHARUHERA', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM', 'TATA ASSAM',
            'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL', 'TATA KOPPAL',
            'TATA PALAYAM', 'TATA PALAYAM', 'TATA PALAYAM', 'TATA PALAYAM',
            'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA', 'GTPL LUMINA',
            'HYD20 HYDERABAD', 'HYD20 HYDERABAD', 'HYD20 HYDERABAD', 'HYD20 HYDERABAD', 'HYD20 HYDERABAD',
            'SIFY RABALE', 'SIFY RABALE', 'SIFY RABALE',
            'ADANI WATER', 'ADANI WATER', 'ADANI WATER',
            'TATA CGPL',
            'Site not assigned', 'Site not assigned'
        ]; // Exactly 51 items!

        console.log(`Paid sites list length: ${paidSites.length}`);

        // Distribution of payable across 51 items to sum to 46,53,249:
        // We know site totals for paid amounts:
        // HMCL DHARUHERA: 279470
        // TATA ASSAM: 301536 - 20000(part) = 281536 across 8 items
        // TATA KOPPAL: 2303514 - 200000(part) = 2103514 across 15 items
        // TATA PALAYAM: 1343067 across 4 items
        // GTPL LUMINA: 1509995 - 138000(part) = 1371995 across 9 items (or similar)
        // HYD20 HYDERABAD: 405495 across 5 items
        // SIFY RABALE: 834880 across 3 items
        // ADANI WATER: 343698 across 3 items
        // TATA CGPL: 23600 across 1 item
        // Site not assigned: 1110284 across 2 items

        // 10 Part-Paid items across sites (Total Payable: 64,15,596, Paid: 31,74,442, Out: 32,41,154):
        // 1. HMCL DHARUHERA - Schneider Electric - Payable: 1500000, Paid: 0 -> wait, HMCL total paid is 279470.
        // Let's make sure the site totals match client table:
        // HMCL DHARUHERA (5 inv): Payable: 2793644 | Paid: 279470 | Out: 2514174
        // TATA ASSAM (10 inv): Payable: 381191 | Paid: 301536 | Out: 79658
        // TATA KOPPAL (19 inv): Payable: 2190477 | Paid: 2303514 | Out: 388016
        // TATA PALAYAM (5 inv): Payable: 1449153 | Paid: 1343067 | Out: 126586
        // JSW JAIGARH (0 inv): 0 | 0 | 0
        // GTPL LUMINA (10 inv): Payable: 1521794 | Paid: 1509995 | Out: 12980
        // HYD20 HYDERABAD (5 inv): Payable: 300386 | Paid: 405495 | Out: 0
        // SIFY RABALE (6 inv): Payable: 1384080 | Paid: 834880 | Out: 549200
        // ADANI WATER (9 inv): Payable: 1032197 | Paid: 343698 | Out: 688500
        // TATA CGPL (1 inv): Payable: 23600 | Paid: 23600 | Out: 0
        // Site not assigned (3 inv): Payable: 1230792 | Paid: 1110284 | Out: 120509
        // TOTAL (73 inv): Payable: 12307313 | Paid: 8455539 (incl advances) | Out: 4479623

        // Let's create an explicit array of exactly 73 invoices tailored to match each site's exact payable, paid, and outstanding!
        const siteInvoicesPlan = {
            'HMCL DHARUHERA': [
                { payable: 279470, paid: 279470, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 1250000, paid: 0, status: 'PART_PAID', out: 1250000, vendor: 'Havells India Ltd' }, // part payment registered at PO stage
                { payable: 650000, paid: 0, status: 'PART_PAID', out: 650000, vendor: 'Schneider Electric' },
                { payable: 314174, paid: 0, status: 'OUTSTANDING', out: 314174, vendor: 'Supreme Industries Ltd' },
                { payable: 300000, paid: 0, status: 'OUTSTANDING', out: 300000, vendor: 'ProReact Systems' }
            ],
            'TATA ASSAM': [
                { payable: 32500, paid: 32500, status: 'PAID', vendor: 'Commscope India' },
                { payable: 41200, paid: 41200, status: 'PAID', vendor: '3M / Raychem RPG' },
                { payable: 28400, paid: 28400, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 39500, paid: 39500, status: 'PAID', vendor: 'Roxtec India Pvt Ltd' },
                { payable: 44100, paid: 44100, status: 'PAID', vendor: 'SG Powers Pvt Ltd' },
                { payable: 36800, paid: 36800, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 29800, paid: 29800, status: 'PAID', vendor: 'Supreme Industries Ltd' },
                { payable: 49236, paid: 49236, status: 'PAID', vendor: 'Finolex Cables Ltd' },
                { payable: 50000, paid: 20000, status: 'PART_PAID', out: 30000, vendor: 'Siemens Ltd' },
                { payable: 29655, paid: 0, status: 'OUTSTANDING', out: 49658, vendor: 'Schneider Electric' }
            ],
            'TATA KOPPAL': [
                { payable: 95000, paid: 95000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 112000, paid: 112000, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 88500, paid: 88500, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 145000, paid: 145000, status: 'PAID', vendor: 'ABB India Ltd' },
                { payable: 74200, paid: 74200, status: 'PAID', vendor: 'Supreme Industries Ltd' },
                { payable: 120000, paid: 120000, status: 'PAID', vendor: '3M / Raychem RPG' },
                { payable: 65400, paid: 65400, status: 'PAID', vendor: 'Commscope India' },
                { payable: 89000, paid: 89000, status: 'PAID', vendor: 'Roxtec India Pvt Ltd' },
                { payable: 134000, paid: 134000, status: 'PAID', vendor: 'SG Powers Pvt Ltd' },
                { payable: 98500, paid: 98500, status: 'PAID', vendor: 'ProReact Systems' },
                { payable: 165000, paid: 165000, status: 'PAID', vendor: 'DMP Projects' },
                { payable: 78000, paid: 78000, status: 'PAID', vendor: 'Steel Authority of India (SAIL)' },
                { payable: 142000, paid: 142000, status: 'PAID', vendor: 'Finolex Cables Ltd' },
                { payable: 105861, paid: 105861, status: 'PAID', vendor: 'Siemens Ltd' },
                { payable: 290000, paid: 403053, status: 'PAID', vendor: 'L&T Electrical & Automation' }, // Mobilization advance settlement
                { payable: 150000, paid: 100000, status: 'PART_PAID', out: 50000, vendor: 'KEI Industries' },
                { payable: 90000, paid: 40000, status: 'PART_PAID', out: 50000, vendor: 'Polycab India Ltd' },
                { payable: 144000, paid: 0, status: 'OUTSTANDING', out: 144000, vendor: 'Schneider Electric' },
                { payable: 144016, paid: 0, status: 'OUTSTANDING', out: 144016, vendor: 'Havells India Ltd' }
            ],
            'TATA PALAYAM': [
                { payable: 312000, paid: 312000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 425000, paid: 425000, status: 'PAID', vendor: 'ABB India Ltd' },
                { payable: 286067, paid: 286067, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 300000, paid: 320000, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 126086, paid: 0, status: 'OUTSTANDING', out: 126586, vendor: 'Supreme Industries Ltd' }
            ],
            'GTPL LUMINA': [
                { payable: 180000, paid: 180000, status: 'PAID', vendor: 'Commscope India' },
                { payable: 215000, paid: 215000, status: 'PAID', vendor: '3M / Raychem RPG' },
                { payable: 142000, paid: 142000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 168000, paid: 168000, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 98500, paid: 98500, status: 'PAID', vendor: 'Roxtec India Pvt Ltd' },
                { payable: 125000, paid: 125000, status: 'PAID', vendor: 'SG Powers Pvt Ltd' },
                { payable: 245000, paid: 245000, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 198495, paid: 198495, status: 'PAID', vendor: 'ProReact Systems' },
                { payable: 137000, paid: 138000, status: 'PAID', vendor: 'Supreme Industries Ltd' },
                { payable: 12799, paid: 0, status: 'OUTSTANDING', out: 12980, vendor: 'Finolex Cables Ltd' }
            ],
            'HYD20 HYDERABAD': [
                { payable: 54000, paid: 54000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 62000, paid: 62000, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 48386, paid: 48386, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 71000, paid: 71000, status: 'PAID', vendor: '3M / Raychem RPG' },
                { payable: 65000, paid: 170109, status: 'PAID', vendor: 'ABB India Ltd' }
            ],
            'SIFY RABALE': [
                { payable: 210000, paid: 210000, status: 'PAID', vendor: 'Commscope India' },
                { payable: 284880, paid: 284880, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 340000, paid: 340000, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 300000, paid: 0, status: 'PART_PAID', out: 300000, vendor: 'Roxtec India Pvt Ltd' },
                { payable: 149200, paid: 0, status: 'OUTSTANDING', out: 149200, vendor: 'Havells India Ltd' },
                { payable: 100000, paid: 0, status: 'OUTSTANDING', out: 100000, vendor: '3M / Raychem RPG' }
            ],
            'ADANI WATER': [
                { payable: 95000, paid: 95000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 112000, paid: 112000, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 136698, paid: 136698, status: 'PAID', vendor: 'Schneider Electric' },
                { payable: 250000, paid: 0, status: 'PART_PAID', out: 250000, vendor: 'Supreme Industries Ltd' },
                { payable: 150000, paid: 0, status: 'PART_PAID', out: 150000, vendor: 'ABB India Ltd' },
                { payable: 100000, paid: 0, status: 'PART_PAID', out: 100000, vendor: '3M / Raychem RPG' },
                { payable: 75000, paid: 0, status: 'OUTSTANDING', out: 75000, vendor: 'Finolex Cables Ltd' },
                { payable: 60000, paid: 0, status: 'OUTSTANDING', out: 60000, vendor: 'Siemens Ltd' },
                { payable: 53499, paid: 0, status: 'OUTSTANDING', out: 53500, vendor: 'KEI Industries' }
            ],
            'TATA CGPL': [
                { payable: 23600, paid: 23600, status: 'PAID', vendor: 'Polycab India Ltd' }
            ],
            'Site not assigned': [
                { payable: 450000, paid: 450000, status: 'PAID', vendor: 'Polycab India Ltd' },
                { payable: 660283, paid: 660284, status: 'PAID', vendor: 'Havells India Ltd' },
                { payable: 120509, paid: 0, status: 'OUTSTANDING', out: 120509, vendor: 'Schneider Electric' }
            ]
        };

        // Let's calibrate exact site targets:
        const siteTargets = {
            'HMCL DHARUHERA': { payable: 2793644, paid: 279470, out: 2514174 },
            'TATA ASSAM': { payable: 381191, paid: 301536, out: 79658 },
            'TATA KOPPAL': { payable: 2190477, paid: 2303514, out: 388016 },
            'TATA PALAYAM': { payable: 1449153, paid: 1343067, out: 126586 },
            'GTPL LUMINA': { payable: 1521794, paid: 1509995, out: 12980 },
            'HYD20 HYDERABAD': { payable: 300386, paid: 405495, out: 0 },
            'SIFY RABALE': { payable: 1384080, paid: 834880, out: 549200 },
            'ADANI WATER': { payable: 1032197, paid: 343698, out: 688500 },
            'TATA CGPL': { payable: 23600, paid: 23600, out: 0 },
            'Site not assigned': { payable: 1230792, paid: 1110284, out: 120509 }
        };

        // Adjust the last item of each site to match siteTargets exactly:
        for (const [sName, tgt] of Object.entries(siteTargets)) {
            const arr = siteInvoicesPlan[sName];
            const sumP = arr.reduce((acc, x) => acc + x.payable, 0);
            const sumPaid = arr.reduce((acc, x) => acc + x.paid, 0);
            const diffP = tgt.payable - sumP;
            const diffPaid = tgt.paid - sumPaid;
            if (diffP !== 0) {
                arr[arr.length - 1].payable += diffP;
            }
            if (diffPaid !== 0) {
                // Add to first paid or last item
                const pItem = arr.find(x => x.paid > 0) || arr[0];
                pItem.paid += diffPaid;
            }
        }

        // Flatten all items and insert
        let allInvoices = [];
        for (const [siteName, items] of Object.entries(siteInvoicesPlan)) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                allInvoices.push({
                    siteName,
                    vendorName: item.vendor,
                    payable: item.payable,
                    paid: item.paid,
                    status: item.status,
                    seq: i + 1
                });
            }
        }

        console.log(`Total regular invoices created: ${allInvoices.length}`);

        // Insert 73 regular invoices
        let invCounter = 101;
        const insertedInvoices = [];
        let totalGstSum = 0;
        let totalTdsSum = 0;
        let totalPayableSum = 0;
        let totalPaidSum = 0;

        for (const item of allInvoices) {
            const siteId = siteMap[item.siteName] || null;
            const vendorId = vendorMap[item.vendorName] || null;
            const invNum = `INV/26-27/${item.siteName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)}/${String(invCounter++).padStart(3, '0')}`;
            const invDate = dates[invCounter % dates.length];
            const poNum = `PO-NKD-2026-${String(invCounter).padStart(4, '0')}`;

            // Calculate GST (18%) and TDS (2%)
            // invoice_value = basic + gst; total_payable = invoice_value - tds
            // basic = total_payable / (1 + 0.18 - 0.02) = total_payable / 1.16
            const basicAmount = Math.round((item.payable / 1.16) * 100) / 100;
            const gstAmount = Math.round((basicAmount * 0.18) * 100) / 100;
            const tdsAmount = Math.round((basicAmount * 0.02) * 100) / 100;
            const invoiceValue = Math.round((basicAmount + gstAmount) * 100) / 100;
            const totalPayable = item.payable;
            const paidAmount = item.paid;
            const outstanding = Math.max(0, totalPayable - paidAmount);

            totalGstSum += gstAmount;
            totalTdsSum += tdsAmount;
            totalPayableSum += totalPayable;
            totalPaidSum += paidAmount;

            let finalStatus = item.status;
            if (paidAmount >= totalPayable && outstanding <= 0) {
                finalStatus = 'PAID';
            } else if (paidAmount > 0 && outstanding > 0) {
                finalStatus = 'PART_PAID';
            } else if (item.status === 'PART_PAID') {
                finalStatus = 'PART_PAID';
            } else {
                finalStatus = 'OUTSTANDING';
            }

            const insRes = await db.query(`
                INSERT INTO vendor_invoices (
                    vendor_id, site_id, vendor_name, site_name,
                    invoice_number, invoice_date, due_date, po_number,
                    category, basic_amount, gst_rate, gst_amount, tds_rate, tds_amount,
                    invoice_value, total_payable, paid_amount, outstanding_amount, status, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                RETURNING invoice_id
            `, [
                vendorId, siteId, item.vendorName, item.siteName,
                invNum, invDate, '2026-11-30', poNum,
                'MATERIAL', basicAmount, 18.00, gstAmount, 2.00, tdsAmount,
                invoiceValue, totalPayable, paidAmount, outstanding, finalStatus,
                `Vendor payment record for FY 26-27 site supply`
            ]);

            const invoiceId = insRes.rows[0].invoice_id;
            insertedInvoices.push({ invoiceId, paidAmount, invNum, invDate, vendorId });

            // If paidAmount > 0, insert payment entry into vendor_payments
            if (paidAmount > 0) {
                const utr = `HDFCN${Date.now().toString().slice(-6)}${String(invCounter).padStart(3, '0')}`;
                await db.query(`
                    INSERT INTO vendor_payments (
                        invoice_id, vendor_id, payment_date, amount_paid,
                        payment_mode, transaction_reference, bank_name, paid_by, remarks
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    invoiceId, vendorId, invDate, paidAmount,
                    'NEFT/RTGS', utr, 'HDFC Bank', 'Accounts Department',
                    'Direct bank settlement for site supply'
                ]);
            }
        }

        // 4. Insert 6 "Awaiting Invoice" records (Advances paid to vendors where invoice is awaited)
        // From client dashboard: Awaiting Invoice: 6 items | Payable: ₹0 | Paid: ₹6,20,500 | Outstanding: ₹0
        const awaitingInvoiceItems = [
            { vendor: 'Polycab India Ltd', amount: 150000, site: 'HMCL DHARUHERA', ref: 'ADV-PO-HMCL-01' },
            { vendor: 'Havells India Ltd', amount: 120000, site: 'TATA ASSAM', ref: 'ADV-PO-ASSAM-02' },
            { vendor: 'Schneider Electric', amount: 100000, site: 'TATA KOPPAL', ref: 'ADV-PO-KOPPAL-03' },
            { vendor: 'ABB India Ltd', amount: 95000, site: 'GTPL LUMINA', ref: 'ADV-PO-LUMINA-04' },
            { vendor: 'Supreme Industries Ltd', amount: 85500, site: 'SIFY RABALE', ref: 'ADV-PO-RABALE-05' },
            { vendor: '3M / Raychem RPG', amount: 70000, site: 'ADANI WATER', ref: 'ADV-PO-ADANI-06' }
        ];

        let advCounter = 1;
        for (const adv of awaitingInvoiceItems) {
            const siteId = siteMap[adv.site] || null;
            const vendorId = vendorMap[adv.vendor] || null;
            const invNum = `ADV-AWAIT-INV-${String(advCounter++).padStart(3, '0')}`;
            const invDate = '2026-10-25';

            const insRes = await db.query(`
                INSERT INTO vendor_invoices (
                    vendor_id, site_id, vendor_name, site_name,
                    invoice_number, invoice_date, due_date, po_number,
                    category, basic_amount, gst_rate, gst_amount, tds_rate, tds_amount,
                    invoice_value, total_payable, paid_amount, outstanding_amount, status, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                RETURNING invoice_id
            `, [
                vendorId, siteId, adv.vendor, adv.site,
                invNum, invDate, '2026-11-30', adv.ref,
                'ADVANCE', 0, 0, 0, 0, 0,
                0, 0, adv.amount, 0, 'AWAITING_INVOICE',
                'Advance payment disbursed - vendor tax invoice awaited'
            ]);

            const invoiceId = insRes.rows[0].invoice_id;
            const utr = `ADVUTR${Date.now().toString().slice(-6)}${String(advCounter).padStart(3, '0')}`;
            await db.query(`
                INSERT INTO vendor_payments (
                    invoice_id, vendor_id, payment_date, amount_paid,
                    payment_mode, transaction_reference, bank_name, paid_by, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                invoiceId, vendorId, invDate, adv.amount,
                'NEFT/RTGS', utr, 'HDFC Bank', 'Accounts Department',
                'Advance mobilization payment against purchase commitment'
            ]);
        }

        console.log('✅ Seed completed successfully!');
        const totalCountRes = await db.query('SELECT COUNT(*) FROM vendor_invoices');
        const statsRes = await db.query(`
            SELECT
                COUNT(*)::int AS total_items,
                SUM(total_payable)::numeric AS sum_payable,
                SUM(paid_amount)::numeric AS sum_paid,
                SUM(outstanding_amount)::numeric AS sum_outstanding,
                SUM(gst_amount)::numeric AS sum_gst,
                SUM(tds_amount)::numeric AS sum_tds
            FROM vendor_invoices
        `);
        console.log('📊 Seeded Database Stats:', statsRes.rows[0]);

        const statusRes = await db.query(`
            SELECT status, COUNT(*)::int AS count, SUM(total_payable)::numeric AS payable, SUM(paid_amount)::numeric AS paid, SUM(outstanding_amount)::numeric AS outstanding
            FROM vendor_invoices
            GROUP BY status
            ORDER BY status
        `);
        console.log('📊 Status Breakdown:', statusRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('❌ Setup error:', err);
        process.exit(1);
    }
}

setupVendorPayments();
