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

CREATE TABLE IF NOT EXISTS shifts (
    shift_id SERIAL PRIMARY KEY,
    shift_code VARCHAR(50) UNIQUE NOT NULL,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    mobile VARCHAR(30), email VARCHAR(150), personal_email VARCHAR(150),
    site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
    shift_id INTEGER REFERENCES shifts(shift_id) ON DELETE SET NULL,
    manager_id INTEGER REFERENCES employees(employee_id) ON DELETE SET NULL,
    designation VARCHAR(150), department VARCHAR(150),
    date_of_joining DATE, date_of_exit DATE, reason_for_exit TEXT,
    wage_type VARCHAR(30) DEFAULT 'MONTHLY', employment_type VARCHAR(30) DEFAULT 'PERMANENT',
    employment_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0, hra NUMERIC(14,2) NOT NULL DEFAULT 0,
    conveyance NUMERIC(14,2) NOT NULL DEFAULT 0, special_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
    other_allowance NUMERIC(14,2) NOT NULL DEFAULT 0, ot_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
    pf_applicable BOOLEAN NOT NULL DEFAULT FALSE, esi_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    pt_applicable BOOLEAN NOT NULL DEFAULT FALSE, uan_number VARCHAR(50), esi_number VARCHAR(50),
    pan_number VARCHAR(50), aadhaar_number VARCHAR(50), bank_name VARCHAR(150),
    account_number VARCHAR(80), ifsc_code VARCHAR(30), address TEXT, permanent_address TEXT,
    documents JSONB NOT NULL DEFAULT '{}'::jsonb, emergency_contact VARCHAR(100), blood_group VARCHAR(10),
    gender VARCHAR(30), father_name VARCHAR(150), dob DATE, nationality VARCHAR(80) DEFAULT 'Indian',
    education VARCHAR(150), skill_category VARCHAR(150), service_book_no VARCHAR(80),
    identification_mark TEXT, remarks TEXT, password_hash VARCHAR(255), role_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE, is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
