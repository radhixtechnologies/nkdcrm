const db = require('../config/database');

async function run() {
    console.log('🚀 Running F&F Settlement Setup & Zulfikar Ahmad Seeding...');

    // 1. Create fnf_settlements table
    await db.query(`
        CREATE TABLE IF NOT EXISTS fnf_settlements (
            settlement_id SERIAL PRIMARY KEY,
            settlement_code VARCHAR(50) UNIQUE NOT NULL,
            employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL,
            employee_name VARCHAR(150) NOT NULL,
            designation VARCHAR(100),
            site_id INT REFERENCES sites(site_id) ON DELETE SET NULL,
            site_name VARCHAR(150),
            date_of_joining DATE,
            date_of_leaving DATE,
            reason_for_leaving VARCHAR(100) DEFAULT 'Termination',
            notice_required_days INT DEFAULT 20,
            notice_served_days INT DEFAULT 0,
            notice_shortfall_days INT DEFAULT 0,
            last_drawn_basic NUMERIC(15,2) DEFAULT 0,
            last_drawn_gross NUMERIC(15,2) DEFAULT 0,
            total_service_days INT DEFAULT 0,
            uan_number VARCHAR(50),
            pro_rata_salary NUMERIC(15,2) DEFAULT 0,
            leave_encashment NUMERIC(15,2) DEFAULT 0,
            bonus_amount NUMERIC(15,2) DEFAULT 0,
            arrears_amount NUMERIC(15,2) DEFAULT 0,
            gratuity_amount NUMERIC(15,2) DEFAULT 0,
            other_dues NUMERIC(15,2) DEFAULT 0,
            total_earnings NUMERIC(15,2) DEFAULT 0,
            pf_deduction NUMERIC(15,2) DEFAULT 0,
            esi_deduction NUMERIC(15,2) DEFAULT 0,
            pt_deduction NUMERIC(15,2) DEFAULT 0,
            tds_deduction NUMERIC(15,2) DEFAULT 0,
            notice_pay_recovery NUMERIC(15,2) DEFAULT 0,
            loan_recovery NUMERIC(15,2) DEFAULT 0,
            damage_recovery NUMERIC(15,2) DEFAULT 0,
            lwf_deduction NUMERIC(15,2) DEFAULT 0,
            other_deductions NUMERIC(15,2) DEFAULT 0,
            total_deductions NUMERIC(15,2) DEFAULT 0,
            net_payable NUMERIC(15,2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'APPROVED',
            payment_status VARCHAR(50) DEFAULT 'PENDING',
            payment_mode VARCHAR(50) DEFAULT 'BANK_TRANSFER',
            payment_reference VARCHAR(100),
            payment_date DATE,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('✅ fnf_settlements table created / verified.');

    // 2. Insert or verify Zulfikar Ahmad in employees
    let empRes = await db.query(`
        SELECT * FROM employees 
        WHERE (first_name ILIKE 'Zulfikar' AND last_name ILIKE '%Ahmad%')
           OR uan_number = '102287083990'
        LIMIT 1
    `);

    let employeeId;
    if (empRes.rows.length === 0) {
        console.log('Adding Zulfikar Ahmad to employees table...');
        const seqRes = await db.query("SELECT nextval('employee_code_seq') AS seq");
        const nextCode = `EMP-${String(seqRes.rows[0].seq).padStart(6, '0')}`;

        const insEmp = await db.query(`
            INSERT INTO employees (
                employee_code, first_name, last_name, full_name,
                designation, department, site_id,
                date_of_joining, date_of_exit, reason_for_exit,
                employment_status, employment_type, wage_type,
                basic_salary, hra, special_allowance, other_allowance,
                uan_number, pf_applicable, esi_applicable, pt_applicable
            ) VALUES (
                $1, 'Zulfikar', 'Ahmad', 'Zulfikar Ahmad',
                'EHS Officer', 'Operations', 13,
                '2026-02-01', '2026-06-07', 'Termination',
                'TERMINATED', 'CONTRACT', 'MONTHLY',
                15000.00, 6000.00, 9000.00, 0.00,
                '102287083990', true, true, true
            )
            RETURNING employee_id, employee_code, full_name;
        `, [nextCode]);
        employeeId = insEmp.rows[0].employee_id;
        console.log('✅ Created employee:', insEmp.rows[0]);
    } else {
        employeeId = empRes.rows[0].employee_id;
        console.log('Found existing employee:', empRes.rows[0].employee_code);
    }

    // 3. Insert or update F&F settlement for Zulfikar Ahmad
    const existingSettlement = await db.query(`
        SELECT settlement_id FROM fnf_settlements WHERE employee_id = $1
    `, [employeeId]);

    if (existingSettlement.rows.length === 0) {
        const insSet = await db.query(`
            INSERT INTO fnf_settlements (
                settlement_code, employee_id, employee_name, designation, site_id, site_name,
                date_of_joining, date_of_leaving, reason_for_leaving,
                notice_required_days, notice_served_days, notice_shortfall_days,
                last_drawn_basic, last_drawn_gross, total_service_days, uan_number,
                pro_rata_salary, leave_encashment, bonus_amount, arrears_amount, gratuity_amount, other_dues, total_earnings,
                pf_deduction, esi_deduction, pt_deduction, tds_deduction, notice_pay_recovery, loan_recovery, damage_recovery, lwf_deduction, other_deductions, total_deductions,
                net_payable, status, remarks
            ) VALUES (
                'FNF-2026-0001', $1, 'Zulfikar Ahmad', 'EHS Officer', 13, 'Sify Rabale',
                '2026-02-01', '2026-06-07', 'Termination',
                20, 6, 14,
                15000.00, 30000.00, 127, '102287083990',
                27888.00, 0.00, 0.00, 0.00, 0.00, 0.00, 27888.00,
                1800.00, 113.00, 200.00, 0.00, 10500.00, 9000.00, 0.00, 25.00, 0.00, 21638.00,
                6250.00, 'APPROVED', 'Full & Final Settlement for Zulfikar Ahmad (EHS Officer, Sify Rabale). Notice shortfall of 14 days recovered.'
            )
            RETURNING *;
        `, [employeeId]);

        console.log('✅ Seeded F&F Settlement:');
        console.table(insSet.rows[0]);
    } else {
        console.log('Settlement already exists for this employee:', existingSettlement.rows[0].settlement_id);
    }

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
});
