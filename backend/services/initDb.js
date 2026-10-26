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

    // Direct guarantee for Recruitment and Invoice tables
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                client_id SERIAL PRIMARY KEY,
                client_code VARCHAR(50) UNIQUE NOT NULL,
                client_name VARCHAR(200) NOT NULL,
                company_name VARCHAR(200),
                gstin VARCHAR(30),
                pan VARCHAR(20),
                contact_person VARCHAR(150),
                email VARCHAR(150),
                phone VARCHAR(30),
                billing_address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                pincode VARCHAR(20),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(client_id) ON DELETE SET NULL;
            ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_no VARCHAR(100);
            ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_expiry DATE;
            ALTER TABLE sites ADD COLUMN IF NOT EXISTS max_labour_capacity INTEGER DEFAULT 50;
            ALTER TABLE sites ADD COLUMN IF NOT EXISTS license_authority VARCHAR(150);

            ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
            ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
            ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(8, 2);
            ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS punch_address TEXT;

            CREATE TABLE IF NOT EXISTS invoices (
                invoice_id SERIAL PRIMARY KEY,
                invoice_number VARCHAR(80) UNIQUE NOT NULL,
                client_id INTEGER REFERENCES clients(client_id) ON DELETE SET NULL,
                site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                billing_month INTEGER NOT NULL,
                billing_year INTEGER NOT NULL,
                subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
                cgst NUMERIC(14,2) NOT NULL DEFAULT 0,
                sgst NUMERIC(14,2) NOT NULL DEFAULT 0,
                igst NUMERIC(14,2) NOT NULL DEFAULT 0,
                tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                tds_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
                tds_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                net_receivable NUMERIC(14,2) NOT NULL DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
                due_date DATE NOT NULL,
                paid_date DATE,
                payment_mode VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5, 2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14, 2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_receivable NUMERIC(14, 2) DEFAULT 0;
            CREATE TABLE IF NOT EXISTS job_requisitions (
                requisition_id SERIAL PRIMARY KEY,
                requisition_code VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(200) NOT NULL,
                department VARCHAR(100) NOT NULL,
                job_location VARCHAR(150) NOT NULL,
                vacancies INTEGER NOT NULL DEFAULT 1,
                experience_required VARCHAR(50),
                min_salary NUMERIC(12,2) DEFAULT 0,
                max_salary NUMERIC(12,2) DEFAULT 0,
                employment_type VARCHAR(50) DEFAULT 'FULL_TIME',
                status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
                job_description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id SERIAL PRIMARY KEY,
                requisition_id INTEGER REFERENCES job_requisitions(requisition_id) ON DELETE SET NULL,
                full_name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL,
                phone VARCHAR(30) NOT NULL,
                current_company VARCHAR(150),
                current_designation VARCHAR(150),
                experience_years NUMERIC(4,1) DEFAULT 0,
                current_stage VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
                interview_date TIMESTAMP,
                interviewer_name VARCHAR(150),
                interview_feedback TEXT,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                resume_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS offer_letters (
                offer_id SERIAL PRIMARY KEY,
                offer_code VARCHAR(50) UNIQUE NOT NULL,
                candidate_id INTEGER REFERENCES candidates(candidate_id) ON DELETE CASCADE,
                designation VARCHAR(150) NOT NULL,
                department VARCHAR(100) NOT NULL,
                site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                offered_ctc NUMERIC(14,2) NOT NULL DEFAULT 0,
                joining_date DATE NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'OFFERED',
                terms_and_conditions TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            -- Vendor & Asset fallback tables
            CREATE TABLE IF NOT EXISTS vendors (
                vendor_id SERIAL PRIMARY KEY,
                vendor_code VARCHAR(50) UNIQUE NOT NULL,
                vendor_name VARCHAR(200) NOT NULL,
                category VARCHAR(100) NOT NULL DEFAULT 'MANPOWER',
                contact_person VARCHAR(150),
                email VARCHAR(150),
                phone VARCHAR(30),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                gstin VARCHAR(30),
                pan VARCHAR(20),
                pf_code VARCHAR(50),
                esic_code VARCHAR(50),
                compliance_status VARCHAR(30) NOT NULL DEFAULT 'COMPLIANT',
                rating NUMERIC(3,1) DEFAULT 4.0,
                bank_name VARCHAR(150),
                account_number VARCHAR(50),
                ifsc_code VARCHAR(20),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS vendor_agreements (
                agreement_id SERIAL PRIMARY KEY,
                agreement_code VARCHAR(50) UNIQUE NOT NULL,
                vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                start_date DATE NOT NULL,
                expiry_date DATE NOT NULL,
                contract_value NUMERIC(14,2) DEFAULT 0,
                sla_terms TEXT,
                status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                document_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS assets (
                asset_id SERIAL PRIMARY KEY,
                asset_code VARCHAR(50) UNIQUE NOT NULL,
                asset_name VARCHAR(200) NOT NULL,
                category VARCHAR(100) NOT NULL,
                brand_model VARCHAR(150),
                serial_number VARCHAR(100),
                quantity_total INTEGER NOT NULL DEFAULT 1,
                quantity_allocated INTEGER NOT NULL DEFAULT 0,
                cost NUMERIC(12,2) DEFAULT 0,
                condition VARCHAR(50) NOT NULL DEFAULT 'NEW',
                site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS asset_allocations (
                allocation_id SERIAL PRIMARY KEY,
                asset_id INTEGER NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
                site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
                return_due_date DATE,
                returned_date DATE,
                quantity INTEGER NOT NULL DEFAULT 1,
                status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
                condition_on_issue VARCHAR(50) DEFAULT 'GOOD',
                condition_on_return VARCHAR(50),
                remarks TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_match_score INTEGER;
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_screening_summary TEXT;
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50);
        `);
    } catch (err) {
        console.warn('Note on recruitment & invoice tables fallback:', err.message);
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
        ALTER TABLE modules ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
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
        ['System Settings', 'SETTINGS', 'Global configuration', 10],
        ['Recruitment & Onboarding', 'RECRUITMENT', 'Requisitions, Interviews, Offers, Onboarding', 11],
        ['Client Master & Invoices', 'INVOICES', 'Clients, Billing & Invoices', 12],
        ['Vendor Management', 'VENDORS', 'Vendor compliance, agreements & ratings', 13],
        ['Asset Management', 'ASSETS', 'Uniforms, helmets, laptops & gear tracking', 14]
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
                INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
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

