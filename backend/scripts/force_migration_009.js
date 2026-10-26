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
-- 1. Perk Types (Master Table)
CREATE TABLE IF NOT EXISTS perk_types (
    perk_type_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_monetary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Perks
INSERT INTO perk_types (name, description, is_monetary) 
VALUES 
('Company Laptop', 'Standard issue MacBook/Dell', TRUE),
('Reserved Parking', 'Allocated parking spot in basement', FALSE),
('Gym Access', 'Access to office gym facilities', FALSE),
('Club Membership', 'Executive club details', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 2. Employee Perks (Assignment Table)
CREATE TABLE IF NOT EXISTS employee_perks (
    emp_perk_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    perk_type_id INTEGER NOT NULL REFERENCES perk_types(perk_type_id),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_perks_employee ON employee_perks(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_perks_status ON employee_perks(status);
`;

(async () => {
    const client = await pool.connect();
    try {
        console.log('Running Perk Management Migration (009)...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 009 successful');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
})();
