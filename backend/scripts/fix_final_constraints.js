const db = require('../config/database');

async function fixFinalConstraints() {
    try {
        console.log('Relaxing final constraints...');

        const queries = [
            `ALTER TABLE employees ALTER COLUMN gender TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN mobile TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN uan_number TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN esi_number TYPE varchar(50)`,
            `ALTER TABLE employees ALTER COLUMN pan_number TYPE varchar(50)`
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await db.query(query);
        }

        console.log('Final Constraints updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
}

fixFinalConstraints();
