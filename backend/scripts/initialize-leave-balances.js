/**
 * Leave Balance Initialization Script
 * Run this once to allocate default leave balances to all active employees
 * 
 * Usage: node scripts/initialize-leave-balances.js [year]
 * Example: node scripts/initialize-leave-balances.js 2026
 */

const db = require('../config/database');

async function initializeLeaveBalances(year) {
    const targetYear = year || new Date().getFullYear();

    console.log(`\n🔄 Initializing leave balances for year ${targetYear}...\n`);

    try {
        // 1. Get all active employees
        const employeesResult = await db.query(
            "SELECT employee_id, employee_code, first_name, last_name FROM employees WHERE employment_status = 'ACTIVE'"
        );
        const employees = employeesResult.rows;
        console.log(`✅ Found ${employees.length} active employees`);

        // 2. Get all leave types
        const typesResult = await db.query('SELECT * FROM leave_types WHERE is_active = TRUE');
        const leaveTypes = typesResult.rows;
        console.log(`✅ Found ${leaveTypes.length} leave types`);

        // 3. Initialize balances
        let successCount = 0;
        let skipCount = 0;

        for (const emp of employees) {
            for (const type of leaveTypes) {
                const initial = parseFloat(type.max_days_per_year) || 0;

                try {
                    const query = `
                        INSERT INTO leave_balances (employee_id, leave_type_id, year, opening_balance, balance)
                        VALUES ($1, $2, $3, $4, $4)
                        ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
                        RETURNING balance_id
                    `;
                    const result = await db.query(query, [emp.employee_id, type.leave_type_id, targetYear, initial]);

                    if (result.rowCount > 0) {
                        successCount++;
                        console.log(`  ✓ ${emp.employee_code} (${emp.first_name}): ${type.leave_code} = ${initial} days`);
                    } else {
                        skipCount++;
                    }
                } catch (error) {
                    console.error(`  ✗ Error for ${emp.employee_code} - ${type.leave_code}:`, error.message);
                }
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   - Records created: ${successCount}`);
        console.log(`   - Records skipped (already exist): ${skipCount}`);
        console.log(`   - Total employees processed: ${employees.length}`);
        console.log(`\n✅ Leave balance initialization complete!\n`);

    } catch (error) {
        console.error('\n❌ Initialization failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const year = process.argv[2] ? parseInt(process.argv[2]) : new Date().getFullYear();

    initializeLeaveBalances(year)
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeLeaveBalances };
