const { pool } = require('../config/database');
const { initializeDatabase } = require('../services/initDb');
const { seedDefaultPermissions } = require('../services/rbacDefaults');

async function seedRbacRoles() {
    console.log('--- Seeding Comprehensive RBAC Roles & Permissions ---');

    await initializeDatabase();
    await seedDefaultPermissions(pool, { overwriteAll: true });

    const check = await pool.query(`
        SELECT r.role_id, r.role_name, r.role_code, COUNT(p.permission_id)::int AS assigned_modules
        FROM roles r
        LEFT JOIN permissions p ON r.role_id = p.role_id
        GROUP BY r.role_id, r.role_name, r.role_code
        ORDER BY r.role_id
    `);

    console.log('✅ All 9 Roles & 16 Modules RBAC matrix successfully synced:');
    console.table(check.rows);
    await pool.end();
    process.exit(0);
}

seedRbacRoles().catch(async (err) => {
    console.error('Seed error:', err);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
});
