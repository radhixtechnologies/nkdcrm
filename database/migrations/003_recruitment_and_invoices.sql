-- 1. Clients Table (Client Master)
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

-- Link sites to clients if client_id column not present
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(client_id) ON DELETE SET NULL;

-- 2. Client Invoices Table (Invoice Status & Billing)
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
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PAID', 'PENDING', 'OVERDUE', 'CANCELLED'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date DATE,
    payment_mode VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Job Requisitions (Recruitment)
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
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INTERVIEWING', 'FILLED', 'ON_HOLD', 'CLOSED'
    job_description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Candidates & Interviews (Recruitment & Interview Scheduling)
CREATE TABLE IF NOT EXISTS candidates (
    candidate_id SERIAL PRIMARY KEY,
    requisition_id INTEGER REFERENCES job_requisitions(requisition_id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    current_company VARCHAR(150),
    current_designation VARCHAR(150),
    experience_years NUMERIC(4,1) DEFAULT 0,
    current_stage VARCHAR(50) NOT NULL DEFAULT 'APPLIED', -- 'APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_EXTENDED', 'HIRED', 'REJECTED'
    interview_date TIMESTAMP,
    interviewer_name VARCHAR(150),
    interview_feedback TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    resume_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Offer Letters & Onboarding
CREATE TABLE IF NOT EXISTS offer_letters (
    offer_id SERIAL PRIMARY KEY,
    offer_code VARCHAR(50) UNIQUE NOT NULL,
    candidate_id INTEGER REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    designation VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
    offered_ctc NUMERIC(14,2) NOT NULL DEFAULT 0,
    joining_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OFFERED', -- 'DRAFT', 'OFFERED', 'ACCEPTED', 'DECLINED', 'JOINED'
    terms_and_conditions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

