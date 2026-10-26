const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runMigrations = async () => {
    try {
        // Construct path relative to backend/scripts
        const migrationsDir = path.join(__dirname, '../../database/migrations');
        console.log(`Checking for migrations in: ${migrationsDir}`);

        if (!fs.existsSync(migrationsDir)) {
            console.log('No migrations folder found.');
            process.exit(0);
        }

        // Get all .sql files
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Run in alphabetical order (important for numbered migrations like 001_, 002_)

        if (files.length === 0) {
            console.log('No migration files found.');
            process.exit(0);
        }

        console.log(`Found ${files.length} migration(s).`);

        // Execute each migration file
        for (const file of files) {
            console.log(`\n--- Running migration: ${file} ---`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            // Split by semicolon to handle multiple statements if needed, 
            // though pg can often handle multiple queries in one string.
            // For robustness with pg driver, simple full execution is usually okay 
            // unless specific transaction control is needed per statement.
            await pool.query(sql);

            console.log(`✅ ${file} executed successfully.`);
        }

        console.log('\nAll migrations completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration runner failed:', err);
        process.exit(1);
    }
};

runMigrations();
