const db = require('../config/database');

async function fixSchemaConstraints() {
    try {
        console.log('Relaxing schema constraints for long text fields...');

        const queries = [
            `ALTER TABLE employees ALTER COLUMN first_name TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN last_name TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN email TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN designation TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN department TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN nationality TYPE varchar(100)`,
            `ALTER TABLE employees ALTER COLUMN education TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN skill_category TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN employment_type TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN service_book_no TYPE varchar(100)`,
            `ALTER TABLE employees ALTER COLUMN bank_name TYPE varchar(150)`,
            `ALTER TABLE employees ALTER COLUMN reason_for_exit TYPE text`,
            `ALTER TABLE employees ALTER COLUMN father_name TYPE varchar(150)`
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await db.query(query);
        }

        console.log('Constraints updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
}

fixSchemaConstraints();
