-- 1. full_name column on employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name VARCHAR(220);
UPDATE employees SET full_name = TRIM(first_name || ' ' || COALESCE(last_name, '')) WHERE full_name IS NULL;

-- 1b. Statutory columns on sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_name VARCHAR(200);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_address TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_name VARCHAR(200);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_address TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS nature_of_work VARCHAR(200);

-- 2. Daily Attendance Table
CREATE TABLE IF NOT EXISTS attendance_daily (
    attendance_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'P',
    source VARCHAR(50) DEFAULT 'WEB_PORTAL',
    check_in TIME,
    check_out TIME,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_daily_emp_date ON attendance_daily(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_att_daily_date ON attendance_daily(date);

-- 3. Monthly Attendance Summary Table
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

-- 4. Biometric Logs Table
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

-- 5. Leave Master & Transactions
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

-- 6. Payroll Config & Payroll Table
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
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll(month, year);

-- 7. Benefit Types & Employee Benefits & Reimbursements
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
    ('Internet Allowance', 'REIMBURSEMENT', 'Work from home internet bill')
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

-- 8. Perk Types & Employee Perks
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
    ('Club Membership', 'Executive club details', TRUE)
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
