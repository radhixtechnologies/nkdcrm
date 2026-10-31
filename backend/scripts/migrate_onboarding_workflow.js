const { pool } = require('../config/database');

async function migrateOnboardingWorkflow() {
    try {
        console.log('--- Migrating Onboarding 10-Step Workflow Schema ---');

        // 1. Add document fields to candidates table
        await pool.query(`
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50);
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
            ALTER TABLE candidates ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';
        `);
        console.log('✅ candidates table updated with document & bank columns');

        // 2. Add workflow tracking fields to offer_letters table
        await pool.query(`
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
        `);
        console.log('✅ offer_letters table updated with approval & dispatch columns');

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateOnboardingWorkflow();

