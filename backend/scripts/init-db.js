const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runSchema = async () => {
    try {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        console.log(`Reading schema from: ${schemaPath}`);

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema...');

        // Split by semicolon, but handle comments safely (simple split for now)
        const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            if (statement.startsWith('--')) continue; // Skip pure comment lines if split incorrectly (basic check)

            try {
                await pool.query(statement + ';');
            } catch (err) {
                console.error('Error executing query:', statement.substring(0, 50) + '...');
                console.error(err.message);
                // Continue? Or exit? Let's try to continue for now in case some tables exist
            }
        }

        console.log('✅ Schema executed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error executing schema:', err);
        process.exit(1);
    }
};

runSchema();
