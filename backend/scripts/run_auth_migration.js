/**
 * Simple Authentication Migration Runner
 * Runs the auth migration with better error handling
 */

const { pool } = require('../config/database');

const runMigration = async () => {
    const client = await pool.connect();

    try {
        console.log('🔄 Running authentication & RBAC migration...\n');

        // Note: Not using transaction to allow partial success if tables exist

        // 1. Create roles table
        console.log('1️⃣  Creating roles table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                role_id SERIAL PRIMARY KEY,
                role_name VARCHAR(50) UNIQUE NOT NULL,
                role_code VARCHAR(20) UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Insert default roles
        console.log('2️⃣  Inserting default roles...');
        await client.query(`
            INSERT INTO roles (role_name, role_code, description) VALUES
            ('Super Admin', 'SUPER_ADMIN', 'Full system access'),
            ('HR Admin', 'HR_ADMIN', 'HR operations'),
            ('Finance Manager', 'FINANCE_MANAGER', 'Financial operations'),
            ('Department Manager', 'DEPT_MANAGER', 'Team management'),
            ('Employee', 'EMPLOYEE', 'Self-service')
            ON CONFLICT (role_code) DO NOTHING;
        `);

        // 3. Create users table
        console.log('3️⃣  Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                employee_id INTEGER,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role_id INTEGER NOT NULL REFERENCES roles(role_id),
                is_active BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                last_login TIMESTAMP,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                password_reset_token VARCHAR(255),
                password_reset_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Create modules table
        console.log('4️⃣  Creating modules table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS modules (
                module_id SERIAL PRIMARY KEY,
                module_name VARCHAR(50) UNIQUE NOT NULL,
                module_code VARCHAR(20) UNIQUE NOT NULL,
                description TEXT,
                display_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE modules ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
        `);

        // 5. Insert default modules
        console.log('5️⃣  Inserting default modules...');
        await client.query(`
            INSERT INTO modules (module_name, module_code, description) VALUES
            ('Dashboard', 'DASHBOARD', 'Dashboard and analytics'),
            ('Employees', 'EMPLOYEES', 'Employee master data management'),
            ('Attendance', 'ATTENDANCE', 'Attendance tracking and management'),
            ('Leaves', 'LEAVES', 'Leave management and approvals'),
            ('Payroll', 'PAYROLL', 'Payroll processing and salary management'),
            ('Benefits', 'BENEFITS', 'Benefits and insurance management'),
            ('Perks', 'PERKS', 'Perks management'),
            ('Reimbursements', 'REIMBURSEMENTS', 'Reimbursement claims and approvals'),
            ('Reports', 'REPORTS', 'Reports and exports'),
            ('Sites', 'SITES', 'Site/branch management'),
            ('Users', 'USERS', 'User and role management'),
            ('Settings', 'SETTINGS', 'System configuration')
            ON CONFLICT (module_code) DO NOTHING;
        `);

        // 6. Create permissions table (drop if old schema missing role_id)
        console.log('6️⃣  Creating permissions table...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'role_id'
                ) THEN 
                    DROP TABLE permissions CASCADE; 
                END IF; 
            END $$;
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                permission_id SERIAL PRIMARY KEY,
                role_id INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
                module_id INTEGER NOT NULL REFERENCES modules(module_id) ON DELETE CASCADE,
                can_view BOOLEAN DEFAULT FALSE,
                can_create BOOLEAN DEFAULT FALSE,
                can_update BOOLEAN DEFAULT FALSE,
                can_delete BOOLEAN DEFAULT FALSE,
                can_approve BOOLEAN DEFAULT FALSE,
                can_export BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role_id, module_id)
            );
        `);

        // 7. Create audit logs table
        console.log('7️⃣  Creating audit_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL,
                module VARCHAR(50),
                record_id INTEGER,
                old_values JSONB,
                new_values JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 8. Create indexes (with error handling for each)
        console.log('8️⃣  Creating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id)',
            'CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role_id)',
            'CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)'
        ];

        for (const indexSQL of indexes) {
            try {
                await client.query(indexSQL);
            } catch (err) {
                console.log(`   ⚠️  Index skipped (may already exist): ${err.message}`);
            }
        }

        // 9. Set permissions for Super Admin
        console.log('9️⃣  Setting permissions for Super Admin...');
        await client.query(`
            INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
            SELECT r.role_id, m.module_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
            FROM roles r
            CROSS JOIN modules m
            WHERE r.role_code = 'SUPER_ADMIN'
            ON CONFLICT (role_id, module_id) DO NOTHING;
        `);

        // 10. Set permissions for HR Admin
        console.log('🔟 Setting permissions for HR Admin...');
        await client.query(`
            INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
            SELECT r.role_id, m.module_id,
                TRUE,
                CASE WHEN m.module_code IN ('EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'BENEFITS', 'PERKS', 'REIMBURSEMENTS', 'SITES') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'BENEFITS', 'PERKS', 'REIMBURSEMENTS', 'SITES') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('EMPLOYEES', 'ATTENDANCE', 'SITES') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('LEAVES', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('DASHBOARD', 'EMPLOYEES', 'ATTENDANCE', 'PAYROLL', 'REPORTS') THEN TRUE ELSE FALSE END
            FROM roles r
            CROSS JOIN modules m
            WHERE r.role_code = 'HR_ADMIN' AND m.module_code NOT IN ('USERS', 'SETTINGS')
            ON CONFLICT (role_id, module_id) DO NOTHING;
        `);

        // 11. Set permissions for Finance Manager
        console.log('1️⃣1️⃣ Setting permissions for Finance Manager...');
        await client.query(`
            INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
            SELECT r.role_id, m.module_id,
                CASE WHEN m.module_code IN ('DASHBOARD', 'EMPLOYEES', 'PAYROLL', 'REIMBURSEMENTS', 'REPORTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('PAYROLL') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('PAYROLL') THEN TRUE ELSE FALSE END,
                FALSE,
                CASE WHEN m.module_code IN ('REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('PAYROLL', 'REPORTS') THEN TRUE ELSE FALSE END
            FROM roles r
            CROSS JOIN modules m
            WHERE r.role_code = 'FINANCE_MANAGER'
            ON CONFLICT (role_id, module_id) DO NOTHING;
        `);

        // 12. Set permissions for Department Manager
        console.log('1️⃣2️⃣ Setting permissions for Department Manager...');
        await client.query(`
            INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
            SELECT r.role_id, m.module_id,
                CASE WHEN m.module_code IN ('DASHBOARD', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                FALSE,
                FALSE,
                FALSE,
                CASE WHEN m.module_code IN ('LEAVES', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('ATTENDANCE', 'LEAVES') THEN TRUE ELSE FALSE END
            FROM roles r
            CROSS JOIN modules m
            WHERE r.role_code = 'DEPT_MANAGER'
            ON CONFLICT (role_id, module_id) DO NOTHING;
        `);

        // 13. Set permissions for Employee
        console.log('1️⃣3️⃣ Setting permissions for Employee...');
        await client.query(`
            INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
            SELECT r.role_id, m.module_id,
                CASE WHEN m.module_code IN ('DASHBOARD', 'ATTENDANCE', 'LEAVES', 'PAYROLL', 'BENEFITS', 'PERKS', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('LEAVES', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                CASE WHEN m.module_code IN ('LEAVES', 'REIMBURSEMENTS') THEN TRUE ELSE FALSE END,
                FALSE,
                FALSE,
                FALSE
            FROM roles r
            CROSS JOIN modules m
            WHERE r.role_code = 'EMPLOYEE'
            ON CONFLICT (role_id, module_id) DO NOTHING;
        `);

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📋 Created:');
        console.log('   ✓ roles (5 roles)');
        console.log('   ✓ users');
        console.log('   ✓ modules (12 modules)');
        console.log('   ✓ permissions (all configured)');
        console.log('   ✓ audit_logs');

        console.log('\n👥 Roles:');
        console.log('   • Super Admin');
        console.log('   • HR Admin');
        console.log('   • Finance Manager');
        console.log('   • Department Manager');
        console.log('   • Employee');

        console.log('\n⚠️  Next: Run "node scripts/create_super_admin.js"');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
};

runMigration();
