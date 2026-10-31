-- 006_insurance_dependents_perks.sql
-- Enhanced Insurance Management, Dependents, Specific Reimbursements & Perks

-- 1. Insurance Policies Master
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

-- Seed Default Corporate Group Insurance Policies
INSERT INTO insurance_policies (policy_name, policy_type, provider_name, policy_number, sum_insured, start_date, expiry_date, premium_amount, tpa_name, tpa_toll_free, status)
VALUES
    ('Corporate Group Medical Floater (GMC)', 'GMC', 'ICICI Lombard General Insurance', 'POL-GMC-2026-9921', 500000.00, '2026-04-01', '2027-03-31', 450000.00, 'MediAssist TPA Pvt Ltd', '1800-425-9449', 'ACTIVE'),
    ('Group Personal Accident Cover (GPA)', 'GPA', 'Star Health & Allied Insurance', 'POL-GPA-2026-4418', 1000000.00, '2026-04-01', '2027-03-31', 185000.00, 'Raksha TPA Service', '1800-220-456', 'ACTIVE'),
    ('Group Term Life Security (GTL)', 'GTL', 'Life Insurance Corporation of India (LIC)', 'POL-GTL-2026-1184', 1500000.00, '2026-04-01', '2027-03-31', 220000.00, 'Direct Corporate Servicing', '1800-227-777', 'ACTIVE')
ON CONFLICT (policy_number) DO NOTHING;

-- 2. Employee Dependents (For Family Floater Medical & Enrollment)
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

-- 3. Seed Comprehensive Benefit Types (Insurance & Reimbursements)
INSERT INTO benefit_types (name, category, description) VALUES
    ('Group Medical Insurance (GMC)', 'INSURANCE', 'Hospitalization cashless cover up to ₹5,00,000 for self, spouse & children with TPA network'),
    ('Group Personal Accident (GPA)', 'INSURANCE', '24x7 worldwide accidental death and permanent disability protection up to ₹10,00,000'),
    ('Group Term Life Cover (GTL)', 'INSURANCE', 'Corporate term life financial security for family nominee up to ₹15,00,000'),
    ('Travel & Transit Claim', 'REIMBURSEMENT', 'Official tour rail, bus, airfare, local conveyance & lodging expenses'),
    ('Mobile & Broadband Bill', 'REIMBURSEMENT', 'Monthly official mobile voice/data plan and work broadband reimbursement'),
    ('Fuel & Vehicle Conveyance', 'REIMBURSEMENT', 'Site inspection fuel bills and per-KM conveyance allowance'),
    ('Medical OPD Expense', 'REIMBURSEMENT', 'Outpatient doctor consultation, prescription pharmacy medicines & diagnostic tests'),
    ('Training & Certification', 'REIMBURSEMENT', 'Security supervisor certification, skill training & safety compliance courses')
ON CONFLICT (name) DO NOTHING;

-- 4. Seed Specific Employee Perks
INSERT INTO perk_types (name, description, is_monetary) VALUES
    ('Festival Bonus (Diwali / Eid)', 'Annual festive celebration bonus credited directly with monthly salary', TRUE),
    ('Site Performance Incentive', 'Special monthly incentive for zero absenteeism and client SLA excellence', TRUE),
    ('Uniform & Kit Maintenance', 'Uniform dry-cleaning, safety boot replacement & PPE maintenance allowance', TRUE),
    ('Meal & Shift Food Allowance', 'On-duty shift food coupons, lunch allowance and beverage subsidy', TRUE)
ON CONFLICT (name) DO NOTHING;

