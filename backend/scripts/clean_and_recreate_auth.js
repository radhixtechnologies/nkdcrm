/**
 * Clean and Recreate Authentication Tables
 * Drops existing auth tables and recreates them properly
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'NKD_CRM',
    user: process.env.DB_USER || 'postgres',
    password: () => String(process.env.DB_PASSWORD ?? '')
});

const cleanAndRecreate = async () => {
    const client = await pool.connect();

    try {
        console.log('🔄 Cleaning and recreating authentication tables...\n');

        // Drop existing tables
        console.log('1️⃣  Dropping existing auth tables (if any)...');
        await client.query('DROP TABLE IF EXISTS audit_logs CASCADE');
        await client.query('DROP TABLE IF EXISTS user_sessions CASCADE');
        await client.query('DROP TABLE IF EXISTS permissions CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');
        await client.query('DROP TABLE IF NOT EXISTS modules CASCADE');
        await client.query('DROP TABLE IF EXISTS roles CASCADE');
        console.log('   ✓ Old tables dropped');

        // Now run the migration
        console.log('\n2️⃣  Creating fresh authentication tables...\n');

        // Import and run the migration
        const runMigration = require('./run_auth_migration');

    } catch (error) {
        console.error('\n❌ Clean failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
};

console.log('⚠️  WARNING: This will delete all existing users and auth data!');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(cleanAndRecreate, 3000);
