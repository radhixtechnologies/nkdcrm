const { pool } = require('../config/database');

async function addStatutoryColumns() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: Adding Statutory fields to Employees and Sites tables...');

        await client.query('BEGIN');

        // 1. Update Employees Table
        console.log('Updating employees table...');
        const employeeColumns = [
            "ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
            "ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS dob DATE",
            "ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'Indian'",
            "ADD COLUMN IF NOT EXISTS education VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS skill_category VARCHAR(50)", // Skilled, Semi-Skilled, Unskilled
            "ADD COLUMN IF NOT EXISTS permanent_address TEXT",
            "ADD COLUMN IF NOT EXISTS service_book_no VARCHAR(50)",
            "ADD COLUMN IF NOT EXISTS date_of_exit DATE",
            "ADD COLUMN IF NOT EXISTS reason_for_exit TEXT",
            "ADD COLUMN IF NOT EXISTS identification_mark TEXT",
            "ADD COLUMN IF NOT EXISTS photo_url TEXT", // For storing file path/url
            "ADD COLUMN IF NOT EXISTS signature_url TEXT", // For storing file path/url
            "ADD COLUMN IF NOT EXISTS remarks TEXT"
        ];

        for (const col of employeeColumns) {
            await client.query(`ALTER TABLE employees ${col};`);
            console.log(`Executed: ALTER TABLE employees ${col}`);
        }

        // 2. Update Sites Table (For Register Headers)
        console.log('Updating sites table...');
        const siteColumns = [
            "ADD COLUMN IF NOT EXISTS principal_employer_name VARCHAR(255)",
            "ADD COLUMN IF NOT EXISTS principal_employer_address TEXT",
            "ADD COLUMN IF NOT EXISTS main_contractor_name VARCHAR(255)", // e.g., Hitachi Energy
            "ADD COLUMN IF NOT EXISTS main_contractor_address TEXT",
            "ADD COLUMN IF NOT EXISTS nature_of_work VARCHAR(255)"
        ];

        for (const col of siteColumns) {
            await client.query(`ALTER TABLE sites ${col};`);
            console.log(`Executed: ALTER TABLE sites ${col}`);
        }

        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

addStatutoryColumns();
