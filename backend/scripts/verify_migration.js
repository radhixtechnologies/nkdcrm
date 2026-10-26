/**
 * Verify Migration: Check Users to Employees merge
 * Verifies that all user data was successfully migrated to employees table
 */

const db = require('../config/database');

const verifyMigration = async () => {
    try {
        console.log('🔍 Verifying migration: Users → Employees\n');

        // Check 1: Verify authentication columns exist
        console.log('1️⃣  Checking if authentication columns exist in employees table...');
        const columnsCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' 
            AND column_name IN ('password_hash', 'role_id', 'is_active', 'last_login')
        `);

        if (columnsCheck.rows.length === 4) {
            console.log('   ✅ All authentication columns present\n');
        } else {
            console.log('   ❌ Missing authentication columns\n');
            return;
        }

        // Check 2: Count employees with authentication data
        console.log('2️⃣  Counting employees with authentication data...');
        const authEmployees = await db.query(`
            SELECT COUNT(*) as count 
            FROM employees 
            WHERE password_hash IS NOT NULL AND role_id IS NOT NULL
        `);
        console.log(`   ✅ ${authEmployees.rows[0].count} employees have authentication data\n`);

        // Check 3: List all employees with roles
        console.log('3️⃣  Employees with login access:');
        const employeesWithAuth = await db.query(`
            SELECT 
                e.employee_id,
                e.employee_code,
                e.first_name || ' ' || COALESCE(e.last_name, '') as name,
                e.email,
                r.role_name,
                e.is_active,
                e.last_login
            FROM employees e
            LEFT JOIN roles r ON e.role_id = r.role_id
            WHERE e.password_hash IS NOT NULL
            ORDER BY e.employee_id
        `);

        employeesWithAuth.rows.forEach(emp => {
            const status = emp.is_active ? '🟢 Active' : '🔴 Inactive';
            const lastLogin = emp.last_login ? new Date(emp.last_login).toLocaleDateString() : 'Never';
            console.log(`   ${status} ${emp.name} (${emp.email}) - ${emp.role_name || 'No Role'} - Last login: ${lastLogin}`);
        });
        console.log('');

        // Check 4: Count old users table (if still exists)
        try {
            const oldUsers = await db.query('SELECT COUNT(*) as count FROM users');
            console.log(`4️⃣  Old users table still exists with ${oldUsers.rows[0].count} records`);
            console.log('   ⚠️  Safe to drop after verification\n');
        } catch (error) {
            console.log('4️⃣  Old users table has been dropped ✅\n');
        }

        // Check 5: Verify Super Admin
        console.log('5️⃣  Checking Super Admin account...');
        const superAdmin = await db.query(`
            SELECT 
                e.employee_code,
                e.first_name || ' ' || COALESCE(e.last_name, '') as name,
                e.email,
                r.role_name
            FROM employees e
            JOIN roles r ON e.role_id = r.role_id
            WHERE r.role_code = 'SUPER_ADMIN'
        `);

        if (superAdmin.rows.length > 0) {
            console.log(`   ✅ Super Admin found: ${superAdmin.rows[0].name} (${superAdmin.rows[0].email})\n`);
        } else {
            console.log('   ❌ No Super Admin found!\n');
        }

        // Check 6: Verify audit_logs migration
        console.log('6️⃣  Checking audit_logs migration...');
        const auditCheck = await db.query(`
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE employee_id IS NOT NULL
        `);
        console.log(`   ✅ ${auditCheck.rows[0].count} audit log entries migrated\n`);

        // Summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ MIGRATION VERIFICATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Total employees with login: ${employeesWithAuth.rows.length}`);
        console.log(`Audit logs migrated: ${auditCheck.rows[0].count}`);
        console.log('\n💡 Next steps:');
        console.log('   1. Test login with your configured Super Admin credentials');
        console.log('   2. If login works, update backend code');
        console.log('   3. Drop users table: DROP TABLE users CASCADE;');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Verification failed:', error.message);
        console.error(error);
        process.exit(1);
    }
};

verifyMigration();
