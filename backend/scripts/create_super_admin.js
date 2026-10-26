const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const createSuperAdmin = async () => {
    try {
        console.log('🔄 Creating default Super Admin user...');

        const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@nkdcrm.com').trim().toLowerCase();
        const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
        const password = configuredPassword || crypto.randomBytes(24).toString('base64url');
        const passwordHash = await bcrypt.hash(password, 10);

        // Get Super Admin role ID
        const roleResult = await db.query(
            "SELECT role_id FROM roles WHERE role_code = 'SUPER_ADMIN'"
        );

        if (roleResult.rows.length === 0) {
            console.error('❌ Super Admin role not found. Please run the migration first.');
            process.exit(1);
        }

        const roleId = roleResult.rows[0].role_id;

        // Preserve an existing password unless an explicit replacement was configured.
        const insertQuery = `
            INSERT INTO users (email, password_hash, role_id, is_active, is_verified)
            VALUES ($1, $2, $3, TRUE, TRUE)
            ON CONFLICT (email) DO UPDATE
            SET password_hash = CASE WHEN $4 THEN EXCLUDED.password_hash ELSE users.password_hash END,
                is_active = TRUE,
                is_verified = TRUE,
                updated_at = CURRENT_TIMESTAMP
            RETURNING user_id, email, (xmax = 0) AS created
        `;

        const result = await db.query(insertQuery, [
            email,
            passwordHash,
            roleId,
            Boolean(configuredPassword)
        ]);

        console.log('✅ Super Admin user created successfully!');
        console.log(`\n   Email: ${email}`);
        if (result.rows[0].created && !configuredPassword) {
            console.log(`   Generated password (save it now): ${password}`);
        } else if (configuredPassword) {
            console.log('   Password set from SUPER_ADMIN_PASSWORD.');
        } else {
            console.log('   Existing password preserved.');
        }
        console.log('\nUser ID:', result.rows[0].user_id);

        process.exit(0);

    } catch (error) {
        console.error('❌ Failed to create Super Admin:', error.message);
        console.error(error);
        process.exit(1);
    }
};

createSuperAdmin();
