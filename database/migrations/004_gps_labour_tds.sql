-- Migration 004: GPS Attendance, Labour License Compliance, and Client Invoice TDS

-- 1. GPS Location Coordinates in Daily Attendance
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(8, 2);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS punch_address TEXT;

-- 2. Labour License Compliance in Sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_no VARCHAR(100);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS labour_license_expiry DATE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS max_labour_capacity INTEGER DEFAULT 50;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS license_authority VARCHAR(150);

-- 3. Client TDS (194C / 194J) in Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_receivable NUMERIC(14, 2) DEFAULT 0;

