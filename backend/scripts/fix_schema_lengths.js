const db = require('../config/database');

async function runMigration() {
    try {
        console.log('Starting schema update for statutory fields...');

        // Defined schema changes
        const queries = [
            `ALTER TABLE employees ALTER COLUMN aadhaar_number TYPE varchar(20)`,
            `ALTER TABLE employees ALTER COLUMN mobile TYPE varchar(20)`,
            `ALTER TABLE employees ALTER COLUMN uan_number TYPE varchar(25)`,
            `ALTER TABLE employees ALTER COLUMN esi_number TYPE varchar(25)`,
            `ALTER TABLE employees ALTER COLUMN pan_number TYPE varchar(20)`,
            `ALTER TABLE employees ALTER COLUMN account_number TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN ifsc_code TYPE varchar(20)`,
            `ALTER TABLE employees ALTER COLUMN bank_name TYPE varchar(100)`,
            `ALTER TABLE employees ALTER COLUMN identification_mark TYPE text`,
            `ALTER TABLE employees ALTER COLUMN remarks TYPE text`,
            `ALTER TABLE employees ALTER COLUMN address TYPE text`,
            `ALTER TABLE employees ALTER COLUMN permanent_address TYPE text`
        ];

        for (const query of queries) {
            console.log(`Running: ${query}`);
            await db.query(query);
        }

        console.log('Schema update completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
}

runMigration();
