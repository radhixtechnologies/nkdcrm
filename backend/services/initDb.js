const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { ensureRolesAndModules, seedDefaultPermissions } = require('./rbacDefaults');

const ensureCoreSchema = async () => {
    await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS employee_code_seq;

        CREATE TABLE IF NOT EXISTS sites (
            site_id SERIAL PRIMARY KEY,
            site_code VARCHAR(50) UNIQUE NOT NULL,
            site_name VARCHAR(150) NOT NULL,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            pincode VARCHAR(20),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            principal_employer_name VARCHAR(200),
            principal_employer_address TEXT,
            main_contractor_name VARCHAR(200),
            main_contractor_address TEXT,
            nature_of_work VARCHAR(200),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_name VARCHAR(200);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_address TEXT;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_name VARCHAR(200);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_address TEXT;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS nature_of_work VARCHAR(200);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_no VARCHAR(100);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_expiry DATE;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS max_labour_capacity INTEGER DEFAULT 50;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS license_authority VARCHAR(150);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS excel_grid JSONB DEFAULT NULL;

        CREATE TABLE IF NOT EXISTS shifts (
            shift_id SERIAL PRIMARY KEY,
            shift_code VARCHAR(50) UNIQUE NOT NULL,
            shift_name VARCHAR(100) NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            break_minutes INTEGER NOT NULL DEFAULT 30,
            description TEXT,
            is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 30;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS description TEXT;

        CREATE TABLE IF NOT EXISTS employees (
            employee_id SERIAL PRIMARY KEY,
            employee_code VARCHAR(50) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100),
            full_name VARCHAR(220),
            mobile VARCHAR(30),
            email VARCHAR(150),
            personal_email VARCHAR(150),
            site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
            shift_id INTEGER REFERENCES shifts(shift_id) ON DELETE SET NULL,
            manager_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
            designation VARCHAR(150),
            department VARCHAR(150),
            date_of_joining DATE,
            date_of_exit DATE,
            reason_for_exit TEXT,
            wage_type VARCHAR(30) DEFAULT 'MONTHLY',
            employment_type VARCHAR(30) DEFAULT 'PERMANENT',
            employment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
            basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
            hra NUMERIC(14,2) NOT NULL DEFAULT 0,
            conveyance NUMERIC(14,2) NOT NULL DEFAULT 0,
            special_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
            other_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
            ot_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
            pf_applicable BOOLEAN NOT NULL DEFAULT FALSE,
            esi_applicable BOOLEAN NOT NULL DEFAULT FALSE,
            pt_applicable BOOLEAN NOT NULL DEFAULT FALSE,
            uan_number VARCHAR(50),
            esi_number VARCHAR(50),
            pan_number VARCHAR(50),
            aadhaar_number VARCHAR(50),
            bank_name VARCHAR(150),
            account_number VARCHAR(80),
            ifsc_code VARCHAR(30),
            address TEXT,
            permanent_address TEXT,
            documents JSONB NOT NULL DEFAULT '{}'::jsonb,
            emergency_contact VARCHAR(100),
            blood_group VARCHAR(10),
            gender VARCHAR(30),
            father_name VARCHAR(150),
            dob DATE,
            nationality VARCHAR(80) DEFAULT 'Indian',
            education VARCHAR(150),
            skill_category VARCHAR(150),
            service_book_no VARCHAR(80),
            identification_mark TEXT,
            remarks TEXT,
            password_hash VARCHAR(255),
            role_id INTEGER,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name VARCHAR(220);
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS incentive_allowance NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS gratuity_amount NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS total_ctc NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE employees ADD COLUMN IF NOT EXISTS net_take_home NUMERIC(15, 2) DEFAULT 0;
        UPDATE employees SET full_name = TRIM(first_name || ' ' || COALESCE(last_name, '')) WHERE full_name IS NULL;

        CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);
        CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
        CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

        CREATE TABLE IF NOT EXISTS attendance_daily (
            attendance_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            date DATE NOT NULL,
            status VARCHAR(10) NOT NULL DEFAULT 'P',
            source VARCHAR(50) DEFAULT 'WEB_PORTAL',
            check_in TIME,
            check_out TIME,
            remarks TEXT,
            latitude NUMERIC(10, 7),
            longitude NUMERIC(10, 7),
            location_accuracy NUMERIC(8, 2),
            punch_address TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, date)
        );
        ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
        ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
        ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(8, 2);
        ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS punch_address TEXT;
        CREATE INDEX IF NOT EXISTS idx_att_daily_emp_date ON attendance_daily(employee_id, date);
        CREATE INDEX IF NOT EXISTS idx_att_daily_date ON attendance_daily(date);

        CREATE TABLE IF NOT EXISTS attendance_punch_logs (
            punch_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            punch_date DATE NOT NULL,
            check_in TIME NOT NULL,
            check_out TIME,
            source VARCHAR(50) DEFAULT 'WEB_PORTAL',
            latitude NUMERIC(10, 7),
            longitude NUMERIC(10, 7),
            location_accuracy NUMERIC(8, 2),
            punch_address TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_att_punch_emp_date ON attendance_punch_logs(employee_id, punch_date DESC, check_in DESC);

        CREATE TABLE IF NOT EXISTS attendance (
            attendance_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            total_days INTEGER NOT NULL,
            present_days NUMERIC(5,2) DEFAULT 0,
            absent_days NUMERIC(5,2) DEFAULT 0,
            weekly_off_days NUMERIC(5,2) DEFAULT 0,
            leave_days NUMERIC(5,2) DEFAULT 0,
            half_days NUMERIC(5,2) DEFAULT 0,
            overtime_hours NUMERIC(6,2) DEFAULT 0,
            day_wise_attendance JSONB NOT NULL DEFAULT '{}'::jsonb,
            uploaded_by VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, month, year)
        );
        CREATE INDEX IF NOT EXISTS idx_attendance_emp_period ON attendance(employee_id, month, year);

        CREATE TABLE IF NOT EXISTS biometric_logs (
            log_id SERIAL PRIMARY KEY,
            employee_code VARCHAR(50) NOT NULL,
            punch_date DATE NOT NULL,
            in_time TIME,
            out_time TIME,
            device_id VARCHAR(50),
            upload_batch_id VARCHAR(100),
            uploaded_by VARCHAR(100),
            is_processed BOOLEAN DEFAULT FALSE,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_code, punch_date)
        );
        CREATE INDEX IF NOT EXISTS idx_biometric_processed ON biometric_logs(is_processed);
        CREATE INDEX IF NOT EXISTS idx_biometric_batch ON biometric_logs(upload_batch_id);

        CREATE TABLE IF NOT EXISTS leave_types (
            leave_type_id SERIAL PRIMARY KEY,
            leave_code VARCHAR(20) UNIQUE NOT NULL,
            leave_name VARCHAR(100) NOT NULL,
            description TEXT,
            max_days_per_year NUMERIC(5,2) DEFAULT 12,
            is_paid BOOLEAN DEFAULT TRUE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO leave_types (leave_code, leave_name, description, max_days_per_year, is_paid)
        VALUES
            ('CL', 'Casual Leave', 'Casual Leave', 12, TRUE),
            ('SL', 'Sick Leave', 'Sick Leave', 12, TRUE),
            ('PL', 'Privilege Leave', 'Privilege / Earned Leave', 15, TRUE),
            ('LWP', 'Leave Without Pay', 'Unpaid Leave', 365, FALSE)
        ON CONFLICT (leave_code) DO NOTHING;

        CREATE TABLE IF NOT EXISTS leave_balances (
            balance_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            leave_type_id INTEGER NOT NULL REFERENCES leave_types(leave_type_id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            opening_balance NUMERIC(5,2) DEFAULT 0,
            earned NUMERIC(5,2) DEFAULT 0,
            taken NUMERIC(5,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, leave_type_id, year)
        );

        CREATE TABLE IF NOT EXISTS leave_requests (
            request_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            leave_type_id INTEGER NOT NULL REFERENCES leave_types(leave_type_id) ON DELETE CASCADE,
            from_date DATE NOT NULL,
            to_date DATE NOT NULL,
            total_days NUMERIC(5,2) NOT NULL,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'PENDING',
            approved_by INTEGER REFERENCES employees(employee_id),
            approved_on TIMESTAMP,
            remarks TEXT,
            rejection_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
        CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

        CREATE TABLE IF NOT EXISTS payroll_config (
            config_id SERIAL PRIMARY KEY,
            config_key VARCHAR(50) UNIQUE NOT NULL,
            config_value VARCHAR(100) NOT NULL,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO payroll_config (config_key, config_value, description) VALUES
            ('WORKING_DAYS_PER_MONTH', '26', 'Standard working days per month'),
            ('OVERTIME_MULTIPLIER', '2', 'Multiplier for overtime hourly pay'),
            ('PF_EMPLOYEE_RATE', '0.12', 'PF Employee contribution rate (12%)'),
            ('PF_EMPLOYER_RATE', '0.12', 'PF Employer contribution rate (12%)'),
            ('PF_WAGE_CEILING', '15000', 'PF wage ceiling limit in INR'),
            ('ESI_EMPLOYEE_RATE', '0.0075', 'ESI Employee rate (0.75%)'),
            ('ESI_EMPLOYER_RATE', '0.0325', 'ESI Employer rate (3.25%)'),
            ('ESI_WAGE_CEILING', '21000', 'ESI wage ceiling limit in INR'),
            ('PT_RATE', '200', 'Standard PT deduction in INR')
        ON CONFLICT (config_key) DO NOTHING;

        CREATE TABLE IF NOT EXISTS payroll (
            payroll_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            attendance_id INTEGER REFERENCES attendance(attendance_id) ON DELETE SET NULL,
            calculated_by VARCHAR(100) DEFAULT 'System',
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            total_days INTEGER DEFAULT 30,
            present_days NUMERIC(5,2) DEFAULT 0,
            absent_days NUMERIC(5,2) DEFAULT 0,
            weekly_off_days NUMERIC(5,2) DEFAULT 0,
            leave_days NUMERIC(5,2) DEFAULT 0,
            half_days NUMERIC(5,2) DEFAULT 0,
            overtime_hours NUMERIC(6,2) DEFAULT 0,
            basic_earned NUMERIC(14,2) DEFAULT 0,
            hra_earned NUMERIC(14,2) DEFAULT 0,
            conveyance_earned NUMERIC(14,2) DEFAULT 0,
            special_allowance_earned NUMERIC(14,2) DEFAULT 0,
            other_allowance_earned NUMERIC(14,2) DEFAULT 0,
            overtime_amount NUMERIC(14,2) DEFAULT 0,
            gross_earnings NUMERIC(14,2) DEFAULT 0,
            pf_employee NUMERIC(14,2) DEFAULT 0,
            pf_employer NUMERIC(14,2) DEFAULT 0,
            esi_employee NUMERIC(14,2) DEFAULT 0,
            esi_employer NUMERIC(14,2) DEFAULT 0,
            professional_tax NUMERIC(14,2) DEFAULT 0,
            tds NUMERIC(14,2) DEFAULT 0,
            advance_deduction NUMERIC(14,2) DEFAULT 0,
            other_deductions NUMERIC(14,2) DEFAULT 0,
            total_deductions NUMERIC(14,2) DEFAULT 0,
            net_salary NUMERIC(14,2) DEFAULT 0,
            payment_status VARCHAR(20) DEFAULT 'PENDING',
            payment_date DATE,
            payment_mode VARCHAR(50),
            payment_reference VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, month, year)
        );
        CREATE INDEX IF NOT EXISTS idx_payroll_emp_period ON payroll(employee_id, month, year);
        ALTER TABLE payroll ADD COLUMN IF NOT EXISTS incentive_earned NUMERIC(15, 2) DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll(month, year);

        CREATE TABLE IF NOT EXISTS benefit_types (
            benefit_type_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            category VARCHAR(20) NOT NULL CHECK (category IN ('INSURANCE', 'REIMBURSEMENT', 'PERK')),
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO benefit_types (name, category, description) VALUES
            ('Health Insurance', 'INSURANCE', 'Standard medical coverage'),
            ('Travel Allowance', 'REIMBURSEMENT', 'Official travel expenses'),
            ('Gym Membership', 'PERK', 'Monthly wellness allowance'),
            ('Internet Allowance', 'REIMBURSEMENT', 'Work from home internet bill'),
            ('Group Medical Insurance (GMC)', 'INSURANCE', 'Hospitalization cashless cover up to 5,00,000 for self, spouse & children with TPA network'),
            ('Group Personal Accident (GPA)', 'INSURANCE', '24x7 worldwide accidental death and permanent disability protection up to 10,00,000'),
            ('Group Term Life Cover (GTL)', 'INSURANCE', 'Corporate term life financial security for family nominee up to 15,00,000'),
            ('Travel & Transit Claim', 'REIMBURSEMENT', 'Official tour rail, bus, airfare, local conveyance & lodging expenses'),
            ('Mobile & Broadband Bill', 'REIMBURSEMENT', 'Monthly official mobile voice/data plan and work broadband reimbursement'),
            ('Fuel & Vehicle Conveyance', 'REIMBURSEMENT', 'Site inspection fuel bills and per-KM conveyance allowance'),
            ('Medical OPD Expense', 'REIMBURSEMENT', 'Outpatient doctor consultation, prescription pharmacy medicines & diagnostic tests'),
            ('Training & Certification', 'REIMBURSEMENT', 'Security supervisor certification, skill training & safety compliance courses')
        ON CONFLICT (name) DO NOTHING;

        CREATE TABLE IF NOT EXISTS employee_benefits (
            emp_benefit_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            benefit_type_id INTEGER NOT NULL REFERENCES benefit_types(benefit_type_id) ON DELETE CASCADE,
            policy_number VARCHAR(100),
            details TEXT,
            start_date DATE NOT NULL,
            end_date DATE,
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_emp_benefits_employee ON employee_benefits(employee_id);

        CREATE TABLE IF NOT EXISTS reimbursements (
            claim_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            benefit_type_id INTEGER NOT NULL REFERENCES benefit_types(benefit_type_id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
            claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
            description TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
            rejection_reason TEXT,
            approved_by INTEGER REFERENCES employees(employee_id),
            paid_on DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_reimbursements_status ON reimbursements(status);
        CREATE INDEX IF NOT EXISTS idx_reimbursements_employee ON reimbursements(employee_id);

        CREATE TABLE IF NOT EXISTS perk_types (
            perk_type_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            is_monetary BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO perk_types (name, description, is_monetary) VALUES
            ('Company Laptop', 'Standard issue MacBook/Dell', TRUE),
            ('Reserved Parking', 'Allocated parking spot in basement', FALSE),
            ('Gym Access', 'Access to office gym facilities', FALSE),
            ('Club Membership', 'Executive club details', TRUE),
            ('Festival Bonus (Diwali / Eid)', 'Annual festive celebration bonus credited directly with monthly salary', TRUE),
            ('Site Performance Incentive', 'Special monthly incentive for zero absenteeism and client SLA excellence', TRUE),
            ('Uniform & Kit Maintenance', 'Uniform dry-cleaning, safety boot replacement & PPE maintenance allowance', TRUE),
            ('Meal & Shift Food Allowance', 'On-duty shift food coupons, lunch allowance and beverage subsidy', TRUE)
        ON CONFLICT (name) DO NOTHING;

        CREATE TABLE IF NOT EXISTS employee_perks (
            emp_perk_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            perk_type_id INTEGER NOT NULL REFERENCES perk_types(perk_type_id) ON DELETE CASCADE,
            start_date DATE NOT NULL DEFAULT CURRENT_DATE,
            end_date DATE,
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_emp_perks_employee ON employee_perks(employee_id);
        CREATE INDEX IF NOT EXISTS idx_emp_perks_status ON employee_perks(status);

        CREATE TABLE IF NOT EXISTS insurance_policies (
            policy_id SERIAL PRIMARY KEY,
            policy_name VARCHAR(150) NOT NULL,
            policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('GMC', 'GPA', 'GTL', 'MEDICAL', 'ACCIDENT', 'LIFE')),
            provider_name VARCHAR(150) NOT NULL,
            policy_number VARCHAR(100) UNIQUE NOT NULL,
            sum_insured DECIMAL(12,2) NOT NULL,
            start_date DATE NOT NULL,
            expiry_date DATE NOT NULL,
            premium_amount DECIMAL(12,2) DEFAULT 0,
            tpa_name VARCHAR(150) DEFAULT 'MediAssist TPA',
            tpa_toll_free VARCHAR(50) DEFAULT '1800-425-9449',
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'RENEWAL_DUE')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO insurance_policies (policy_name, policy_type, provider_name, policy_number, sum_insured, start_date, expiry_date, premium_amount, tpa_name, tpa_toll_free, status)
        VALUES
            ('Corporate Group Medical Floater (GMC)', 'GMC', 'ICICI Lombard General Insurance', 'POL-GMC-2026-9921', 500000.00, '2026-04-01', '2027-03-31', 450000.00, 'MediAssist TPA Pvt Ltd', '1800-425-9449', 'ACTIVE'),
            ('Group Personal Accident Cover (GPA)', 'GPA', 'Star Health & Allied Insurance', 'POL-GPA-2026-4418', 1000000.00, '2026-04-01', '2027-03-31', 185000.00, 'Raksha TPA Service', '1800-220-456', 'ACTIVE'),
            ('Group Term Life Security (GTL)', 'GTL', 'Life Insurance Corporation of India (LIC)', 'POL-GTL-2026-1184', 1500000.00, '2026-04-01', '2027-03-31', 220000.00, 'Direct Corporate Servicing', '1800-227-777', 'ACTIVE')
        ON CONFLICT (policy_number) DO NOTHING;

        CREATE TABLE IF NOT EXISTS employee_dependents (
            dependent_id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            full_name VARCHAR(150) NOT NULL,
            relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('SPOUSE', 'CHILD', 'FATHER', 'MOTHER', 'OTHER')),
            date_of_birth DATE,
            gender VARCHAR(20) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
            is_covered_under_insurance BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_emp_dependents_emp ON employee_dependents(employee_id);
    `);
};

const runSqlMigrations = async () => {
    const candidatePaths = [
        path.join(__dirname, '../../database/migrations'),
        path.join(__dirname, '../database/migrations'),
        path.join(process.cwd(), 'database/migrations'),
        path.join(process.cwd(), '../database/migrations')
    ];
    const migrationsDir = candidatePaths.find(p => fs.existsSync(p));
    if (!migrationsDir) {
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
            console.log(`✅ Verified migration file: ${file}`);
        } catch (err) {
            console.warn(`Migration note (${file}): ${err.message}`);
        }
    }
};

const runAuthMigration = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
            role_id SERIAL PRIMARY KEY,
            role_name VARCHAR(50) UNIQUE NOT NULL,
            role_code VARCHAR(30) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS modules (
            module_id SERIAL PRIMARY KEY,
            module_name VARCHAR(80) UNIQUE NOT NULL,
            module_code VARCHAR(30) UNIQUE NOT NULL,
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

    await ensureRolesAndModules(pool);
    await seedDefaultPermissions(pool, { overwriteAll: true });
};

const runExtendedModulesSchema = async () => {
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
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_date DATE;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ra_number VARCHAR(50);
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS received_in_bank NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_received_date DATE;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transfer_date DATE;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(15, 2) DEFAULT 0;

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
            aadhaar_number VARCHAR(20),
            pan_number VARCHAR(20),
            bank_name VARCHAR(100),
            bank_account_no VARCHAR(50),
            bank_ifsc VARCHAR(20),
            documents JSONB DEFAULT '{}',
            ai_match_score INTEGER,
            ai_screening_summary TEXT,
            ai_recommendation VARCHAR(50),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50);
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_match_score INTEGER;
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_screening_summary TEXT;
        ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50);

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
            basic_salary NUMERIC(14,2) DEFAULT 0,
            hra NUMERIC(14,2) DEFAULT 0,
            special_allowance NUMERIC(14,2) DEFAULT 0,
            salary_approved_by VARCHAR(100),
            salary_approved_at TIMESTAMP,
            management_approved_by VARCHAR(100),
            management_approved_at TIMESTAMP,
            pdf_generated_at TIMESTAMP,
            email_dispatched_at TIMESTAMP,
            email_dispatch_status VARCHAR(50) DEFAULT 'NOT_SENT',
            acceptance_status VARCHAR(50) DEFAULT 'PENDING',
            acceptance_date TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(14,2) DEFAULT 0;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS hra NUMERIC(14,2) DEFAULT 0;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(14,2) DEFAULT 0;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS salary_approved_by VARCHAR(100);
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS salary_approved_at TIMESTAMP;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS management_approved_by VARCHAR(100);
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS management_approved_at TIMESTAMP;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS email_dispatched_at TIMESTAMP;
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS email_dispatch_status VARCHAR(50) DEFAULT 'NOT_SENT';
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS acceptance_status VARCHAR(50) DEFAULT 'PENDING';
        ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS acceptance_date TIMESTAMP;

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

        CREATE TABLE IF NOT EXISTS daily_progress_reports (
            dpr_id SERIAL PRIMARY KEY,
            report_no VARCHAR(100) UNIQUE NOT NULL,
            site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
            report_date DATE NOT NULL DEFAULT CURRENT_DATE,
            client_name VARCHAR(200) NOT NULL,
            contractor_name VARCHAR(200) DEFAULT 'NKD POWER SOLUTIONS PVT LTD',
            po_number VARCHAR(100),
            po_value NUMERIC(15,2) DEFAULT 0,
            current_billing_value NUMERIC(15,2) DEFAULT 0,
            billing_progress_pct NUMERIC(5,2) DEFAULT 0,
            start_date DATE,
            completion_date DATE,
            today_activities JSONB DEFAULT '[]'::jsonb,
            next_day_activities JSONB DEFAULT '[]'::jsonb,
            show_stoppers JSONB DEFAULT '[]'::jsonb,
            manpower_data JSONB DEFAULT '[]'::jsonb,
            photos JSONB DEFAULT '[]'::jsonb,
            created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_dpr_site ON daily_progress_reports(site_id);
        CREATE INDEX IF NOT EXISTS idx_dpr_date ON daily_progress_reports(report_date);

        CREATE TABLE IF NOT EXISTS vendor_invoices (
            invoice_id SERIAL PRIMARY KEY,
            vendor_id INT REFERENCES vendors(vendor_id) ON DELETE SET NULL,
            site_id INT REFERENCES sites(site_id) ON DELETE SET NULL,
            vendor_name VARCHAR(255) NOT NULL,
            site_name VARCHAR(255) NOT NULL,
            invoice_number VARCHAR(100) NOT NULL,
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
        CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor ON vendor_invoices(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_invoices_site ON vendor_invoices(site_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON vendor_invoices(status);

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
        CREATE INDEX IF NOT EXISTS idx_vendor_payments_inv ON vendor_payments(invoice_id);
    `);

    // Ensure GTPL LUMINA site exists and seed sample DPR if none exist
    const existingDprs = await pool.query('SELECT COUNT(*)::int AS cnt FROM daily_progress_reports');
    if (existingDprs.rows[0].cnt === 0) {
        let luminaSiteId = null;
        const siteCheck = await pool.query("SELECT site_id FROM sites WHERE site_name ILIKE '%Lumina%' OR site_code = 'GTPL-LUMINA' LIMIT 1");
        if (siteCheck.rows.length > 0) {
            luminaSiteId = siteCheck.rows[0].site_id;
        } else {
            const sIns = await pool.query(`
                INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
                VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
                ON CONFLICT (site_code) DO UPDATE SET site_name = EXCLUDED.site_name
                RETURNING site_id
            `);
            luminaSiteId = sIns.rows[0].site_id;
        }

        await pool.query(`
            INSERT INTO daily_progress_reports (
                report_no, site_id, report_date, client_name, contractor_name,
                po_number, po_value, current_billing_value, billing_progress_pct,
                start_date, completion_date,
                today_activities, next_day_activities, show_stoppers, manpower_data, photos
            ) VALUES (
                'GTPL LUMINA/124',
                $1,
                '2026-10-23',
                'LUMINA',
                'NKD POWER SOLUTIONS PVT LTD',
                '600190',
                48374200.00,
                0.00,
                0.00,
                '2026-04-16',
                '2026-07-24',
                $2, $3, $4, $5, $6
            )
            ON CONFLICT (report_no) DO NOTHING
        `, [
            luminaSiteId,
            JSON.stringify([
                { id: 1, description: 'Roxtec material unloading and shifting work, [Engaged Manpower: 07]', status: 'complete', dependencies: 'NKD', photo_ref: 'Photo 1' }
            ]),
            JSON.stringify([
                { id: 1, description: '11 kV trench core cutting (cellar room) and 11KV cable pulling in cellar.', dependencies: 'Civil Clearance' }
            ]),
            JSON.stringify([
                { id: 1, concern_area: 'Substation cellar water seepage clearance from Lumina civil team', intimation_date: '2026-10-20' }
            ]),
            JSON.stringify([
                { trade: 'Site Manager', required: 1, available: 1 },
                { trade: 'EHS Officer', required: 1, available: 1 },
                { trade: 'Electrician', required: 2, available: 0 },
                { trade: 'Engineer', required: 1, available: 0 },
                { trade: 'Fitter', required: 1, available: 0 },
                { trade: 'Welder', required: 1, available: 0 },
                { trade: 'Helper', required: 7, available: 7 },
                { trade: 'Supervisor', required: 1, available: 0 },
                { trade: 'Testing Engineer', required: 1, available: 0 },
                { trade: 'Cable Jointer', required: 2, available: 0 },
                { trade: 'Scaffolding Team', required: 4, available: 0 }
            ]),
            JSON.stringify([
                { id: 1, caption: 'Roxtec Material Unloading at Cellar Room', url: '/uploads/sample_dpr_1.jpg' },
                { id: 2, caption: '11kV Trench Alignment & Shifting', url: '/uploads/sample_dpr_2.jpg' }
            ])
        ]);
    }

    const trenchDewateringService = require('./trenchDewateringService');
    await trenchDewateringService.ensureTable();

    const procurementService = require('./procurementService');
    await procurementService.ensureTable();

    const siteOperationsService = require('./siteOperationsService');
    await siteOperationsService.ensureTables();
};

const createOrUpdateSuperAdmin = async () => {
    const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@nkdcrm.com').trim().toLowerCase();
    const roleResult = await pool.query("SELECT role_id FROM roles WHERE role_code = 'SUPER_ADMIN'");
    if (roleResult.rows.length === 0) return;
    const roleId = roleResult.rows[0].role_id;

    const existingUser = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = $1', [email]);
    if (existingUser.rows.length > 0) {
        console.log(`✅ Super Admin exists: ${email}`);
        return;
    }

    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!password) {
        throw new Error('Set SUPER_ADMIN_PASSWORD to create the initial Super Admin account.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(`
        INSERT INTO users (email, password_hash, role_id, is_active, is_verified)
        VALUES ($1, $2, $3, TRUE, TRUE)
        ON CONFLICT (email) DO NOTHING
    `, [email, passwordHash, roleId]);

    console.log(`✅ Super Admin created: ${email}`);
};

const initializeDatabase = async () => {
    console.log('🔄 Initializing database schema, RBAC permissions & Super Admin...');
    await ensureCoreSchema();
    await runSqlMigrations();
    await runAuthMigration();
    await runExtendedModulesSchema();
    await createOrUpdateSuperAdmin();
    console.log('✅ Database initialization complete!');
    return { success: true, message: 'Database schema, RBAC permissions & Super Admin initialized successfully!' };
};

module.exports = { initializeDatabase };
