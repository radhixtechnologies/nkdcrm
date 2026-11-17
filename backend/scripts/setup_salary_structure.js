const db = require('../config/database');

async function run() {
    console.log('🚀 Running Salary Structure & Samir Raza Profile Update...');

    // 1. Add extra salary structure columns to employees table if not exists
    await db.query(`
        ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS incentive_allowance NUMERIC(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gratuity_amount NUMERIC(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_ctc NUMERIC(15, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS net_take_home NUMERIC(15, 2) DEFAULT 0;
    `);
    console.log('✅ employees table columns verified / updated.');

    // 2. Also ensure payroll table has incentive_earned if needed
    await db.query(`
        ALTER TABLE payroll 
        ADD COLUMN IF NOT EXISTS incentive_earned NUMERIC(15, 2) DEFAULT 0;
    `);
    console.log('✅ payroll table verified.');

    // 3. Update Samir Raza (EMP-000015) with exact salary structure from client sheet
    const empRes = await db.query(`
        SELECT employee_id, employee_code, first_name, last_name 
        FROM employees 
        WHERE employee_code = 'EMP-000015' OR (first_name ILIKE 'Samir' AND last_name ILIKE 'Raza')
        LIMIT 1
    `);

    if (empRes.rows.length === 0) {
        console.warn('⚠️ Samir Raza not found by code. Searching...');
    } else {
        const emp = empRes.rows[0];
        console.log(`Found Employee: ${emp.employee_code} (${emp.first_name} ${emp.last_name}), updating...`);

        const updateRes = await db.query(`
            UPDATE employees SET
                designation = 'Safety Officer',
                site_id = 9, -- TATA KOPPAL (Chikbonigola Koppal)
                date_of_joining = '2026-09-21',
                wage_type = 'MONTHLY',
                employment_type = 'CONTRACT',
                employment_status = 'ACTIVE',
                basic_salary = 21000.00,
                hra = 8400.00,
                conveyance = 0.00,
                incentive_allowance = 5000.00,
                special_allowance = 4800.00,
                other_allowance = 3000.00,
                gratuity_amount = 1050.00,
                insurance_amount = 630.00,
                total_ctc = 46363.00,
                net_take_home = 40043.00,
                pf_applicable = true,
                esi_applicable = true,
                pt_applicable = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = $1
            RETURNING employee_id, employee_code, full_name, designation, site_id, basic_salary, hra, incentive_allowance, special_allowance, other_allowance, total_ctc, net_take_home;
        `, [emp.employee_id]);

        console.log('✅ Updated Employee Samir Raza:');
        console.table(updateRes.rows[0]);
    }

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
});
