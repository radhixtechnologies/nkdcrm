/**
 * Run Migration: Merge Users into Employees
 * This script executes the migration to combine users and employees tables
 */

const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
    try {
        console.log('🔄 Starting migration: Merge Users into Employees...\n');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, '../../database/migrations/013_merge_users_into_employees.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute the migration
        console.log('📝 Executing migration SQL...');
        await db.query(migrationSQL);

        console.log('\n✅ Migration completed successfully!\n');
        console.log('📋 Changes made:');
        console.log('   ✓ Added authentication fields to employees table');
        console.log('   ✓ Migrated user data to employees table');
        console.log('   ✓ Created employee record for Super Admin');
        console.log('   ✓ Updated audit_logs to reference employees');
        console.log('   ✓ Created indexes for performance');
        console.log('\n⚠️  Next steps:');
        console.log('   1. Verify data migration: node scripts/verify_migration.js');
        console.log('   2. Test login functionality');
        console.log('   3. If everything works, drop users table manually');
        console.log('\n💡 The users table is still present for safety.');
        console.log('   Drop it manually after verification:\n');
        console.log('   DROP TABLE users CASCADE;\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
};

runMigration();
