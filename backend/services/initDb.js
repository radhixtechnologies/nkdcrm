const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const runSqlMigrations = async () => {
    const candidatePaths = [
        path.join(__dirname, '../../database/migrations'),
        path.join(__dirname, '../database/migrations'),
        path.join(process.cwd(), 'database/migrations'),
        path.join(process.cwd(), '../database/migrations')
    ];
    const migrationsDir = candidatePaths.find(p => fs.existsSync(p));
    if (!migrationsDir) {
        console.warn('⚠️ No database/migrations directory found, skipping raw SQL migrations.');
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        try {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            await pool.query(sql);
            console.log(`✅ Applied migration: ${file}`);
        } catch (err) {
            console.warn(`Note on ${file}: ${err.message}`);
        }
    }
};

const runAuthMigration = async () => {
    // 1. Roles table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
            role_id SERIAL PRIMARY KEY,
            role_name VARCHAR(50) UNIQUE NOT NULL,
            role_code VARCHAR(20) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO roles (role_name, role_code, description) VALUES
        ('Super Admin', 'SUPER_ADMIN', 'Full system access'),
        ('HR Admin', 'HR_ADMIN', 'HR operations'),
        ('Finance Manager', 'FINANCE_MANAGER', 'Financial operations'),
        ('Department Manager', 'DEPT_MANAGER', 'Team management'),
        ('Employee', 'EMPLOYEE', 'Self-service')
        ON CONFLICT (role_code) DO NOTHING;
    `);

    // 2. Modules & Permissions
    await pool.query(`
        CREATE TABLE IF NOT EXISTS modules (
            module_id SERIAL PRIMARY KEY,
            module_name VARCHAR(50) UNIQUE NOT NULL,
            module_code VARCHAR(20) UNIQUE NOT NULL,
            description TEXT,
            display_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS permissions (
            permission_id SERIAL PRIMARY KEY,
            module_id INTEGER REFERENCES modules(module_id) ON DELETE CASCADE,
            permission_name VARCHAR(100) NOT NULL,
            permission_code VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            action VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_permission_id SERIAL PRIMARY KEY,
            role_id INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
            module_id INTEGER REFERENCES modules(module_id) ON DELETE CASCADE,
            can_view BOOLEAN DEFAULT FALSE,
            can_create BOOLEAN DEFAULT FALSE,
            can_update BOOLEAN DEFAULT FALSE,
            can_delete BOOLEAN DEFAULT FALSE,
            can_approve BOOLEAN DEFAULT FALSE,
            can_export BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(role_id, module_id)
        );
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            employee_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role_id INTEGER REFERENCES roles(role_id) ON DELETE RESTRICT,
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

    // Modules seed
    const modules = [
        ['Dashboard', 'DASHBOARD', 'Executive dashboard', 1],
        ['Sites & Shifts', 'SITES', 'Site & Shift management', 2],
        ['Employee Directory', 'EMPLOYEES', 'Employee profiles', 3],
        ['Attendance Daily', 'ATTENDANCE', 'Daily attendance & biometric', 4],
        ['Leave Management', 'LEAVES', 'Leave applications & balances', 5],
        ['Payroll Processing', 'PAYROLL', 'Salary generation & slips', 6],
        ['Benefits & Perks', 'BENEFITS', 'Allowances & Reimbursements', 7],
        ['Statutory & Reports', 'REPORTS', 'PF, ESI, PT, TDS reports', 8],
        ['User Management', 'USERS', 'User accounts & RBAC', 9],
        ['System Settings', 'SETTINGS', 'Global configuration', 10]
    ];
    for (const [mName, mCode, desc, order] of modules) {
        await pool.query(`
            INSERT INTO modules (module_name, module_code, description, display_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (module_code) DO NOTHING
        `, [mName, mCode, desc, order]);
    }

    // Give Super Admin full permissions on all modules
    const superAdminRole = await pool.query("SELECT role_id FROM roles WHERE role_code = 'SUPER_ADMIN'");
    if (superAdminRole.rows.length > 0) {
        const sId = superAdminRole.rows[0].role_id;
        const allModules = await pool.query("SELECT module_id FROM modules");
        for (const m of allModules.rows) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
                VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
                ON CONFLICT (role_id, module_id) DO UPDATE SET
                    can_view = TRUE, can_create = TRUE, can_update = TRUE, can_delete = TRUE, can_approve = TRUE, can_export = TRUE
            `, [sId, m.module_id]);
        }
    }
};

const createOrUpdateSuperAdmin = async () => {
    const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@nkdcrm.com').trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';
    const passwordHash = await bcrypt.hash(password, 10);

    const roleResult = await pool.query("SELECT role_id FROM roles WHERE role_code = 'SUPER_ADMIN'");
    if (roleResult.rows.length === 0) return;
    const roleId = roleResult.rows[0].role_id;

    await pool.query(`
        INSERT INTO users (email, password_hash, role_id, is_active, is_verified)
        VALUES ($1, $2, $3, TRUE, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role_id = EXCLUDED.role_id,
            is_active = TRUE,
            is_verified = TRUE,
            updated_at = CURRENT_TIMESTAMP
    `, [email, passwordHash, roleId]);

    console.log(`✅ Super Admin ready: ${email} / ${password}`);
};

const initializeDatabase = async () => {
    console.log('🔄 Initializing database schema, auth & super admin...');
    await runSqlMigrations();
    await runAuthMigration();
    await createOrUpdateSuperAdmin();
    console.log('✅ Database initialization complete!');
    return { success: true, message: 'Database schema, auth tables & Super Admin initialized successfully!' };
};

module.exports = { initializeDatabase };
