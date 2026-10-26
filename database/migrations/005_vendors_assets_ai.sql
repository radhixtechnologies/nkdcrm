-- Migration 005: Vendor Management, Asset Management, and AI Feature extensions

-- 1. Vendors Master Table
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    vendor_name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'MANPOWER', -- 'MANPOWER', 'SECURITY', 'UNIFORM', 'EQUIPMENT', 'IT_HARDWARE', 'CLEANING_SUPPLIES', 'OTHER'
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
    compliance_status VARCHAR(30) NOT NULL DEFAULT 'COMPLIANT', -- 'COMPLIANT', 'NON_COMPLIANT', 'UNDER_AUDIT'
    rating NUMERIC(3,1) DEFAULT 4.0, -- 1.0 to 5.0
    bank_name VARCHAR(150),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Vendor Agreements Table
CREATE TABLE IF NOT EXISTS vendor_agreements (
    agreement_id SERIAL PRIMARY KEY,
    agreement_code VARCHAR(50) UNIQUE NOT NULL,
    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    contract_value NUMERIC(14,2) DEFAULT 0,
    sla_terms TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'TERMINATED'
    document_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Assets Master Table (Uniforms, Helmets, Laptops, Equipment)
CREATE TABLE IF NOT EXISTS assets (
    asset_id SERIAL PRIMARY KEY,
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    asset_name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'UNIFORM', 'HELMET_PPE', 'LAPTOP_IT', 'MOBILE', 'SECURITY_GEAR', 'OTHER'
    brand_model VARCHAR(150),
    serial_number VARCHAR(100),
    quantity_total INTEGER NOT NULL DEFAULT 1,
    quantity_allocated INTEGER NOT NULL DEFAULT 0,
    cost NUMERIC(12,2) DEFAULT 0,
    condition VARCHAR(50) NOT NULL DEFAULT 'NEW', -- 'NEW', 'GOOD', 'NEEDS_REPAIR', 'DAMAGED', 'DISCARDED'
    site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Asset Allocations Table (Employee / Site Issuance & Return)
CREATE TABLE IF NOT EXISTS asset_allocations (
    allocation_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_due_date DATE,
    returned_date DATE,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED', -- 'ISSUED', 'RETURNED', 'LOST', 'DAMAGED'
    condition_on_issue VARCHAR(50) DEFAULT 'GOOD',
    condition_on_return VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add AI Screening fields to Candidates if not present
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_match_score INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_screening_summary TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50);

