const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: () => String(process.env.DB_PASSWORD ?? ''),
    port: process.env.DB_PORT,
});

const sql = `
-- 1. Benefit Types (Master)
CREATE TABLE IF NOT EXISTS benefit_types (
    benefit_type_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('INSURANCE', 'REIMBURSEMENT', 'PERK')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Benefit Types (Idempotent)
INSERT INTO benefit_types (name, category, description) 
SELECT 'Health Insurance', 'INSURANCE', 'Standard medical coverage'
WHERE NOT EXISTS (SELECT 1 FROM benefit_types WHERE name = 'Health Insurance');

INSERT INTO benefit_types (name, category, description) 
SELECT 'Travel Allowance', 'REIMBURSEMENT', 'Official travel expenses'
WHERE NOT EXISTS (SELECT 1 FROM benefit_types WHERE name = 'Travel Allowance');

INSERT INTO benefit_types (name, category, description) 
SELECT 'Gym Membership', 'PERK', 'Monthly wellness allowance'
WHERE NOT EXISTS (SELECT 1 FROM benefit_types WHERE name = 'Gym Membership');

INSERT INTO benefit_types (name, category, description) 
SELECT 'Internet Allowance', 'REIMBURSEMENT', 'Work from home internet bill'
WHERE NOT EXISTS (SELECT 1 FROM benefit_types WHERE name = 'Internet Allowance');

-- 2. Employee Benefits (Assignment)
CREATE TABLE IF NOT EXISTS employee_benefits (
    emp_benefit_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    benefit_type_id INTEGER NOT NULL REFERENCES benefit_types(benefit_type_id),
    policy_number VARCHAR(100), -- Optional: For Insurance
    details TEXT, -- Optional: Extra notes
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_benefits_employee ON employee_benefits(employee_id);

-- 3. Reimbursement Claims (Transactions)
CREATE TABLE IF NOT EXISTS reimbursements (
    claim_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    benefit_type_id INTEGER NOT NULL REFERENCES benefit_types(benefit_type_id),
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
`;

(async () => {
    const client = await pool.connect();
    try {
        console.log('Running migration...');
        await client.query('BEGIN');
        await client.query(sql);

        // Manually insert into schema_migrations if it exists to keep track
        // Assuming table name is 'schema_migrations' or similar based on standard tools, 
        // but the custom runner might use something else. Let's just apply the schema first.

        await client.query('COMMIT');
        console.log('Migration successful');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
})();
