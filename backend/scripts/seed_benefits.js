const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

(async () => {
    const client = await pool.connect();
    try {
        console.log('Seeding benefits...');
        await client.query('BEGIN');

        // 1. Get Benefit Types
        const typesRes = await client.query("SELECT benefit_type_id, name FROM benefit_types");
        const health = typesRes.rows.find(t => t.name === 'Health Insurance');
        const transport = typesRes.rows.find(t => t.name === 'Travel Allowance');

        if (!health || !transport) {
            console.log('Benefit types missing, skipping seed.');
            await client.query('ROLLBACK');
            return;
        }

        // 2. Assign to Employee 1
        // Health Insurance
        await client.query(`
      INSERT INTO employee_benefits (employee_id, benefit_type_id, policy_number, details, start_date, status)
      VALUES (1, $1, 'POL-HEALTH-001', 'Sum Insured: 5 Lakhs', CURRENT_DATE, 'ACTIVE')
      ON CONFLICT DO NOTHING
    `, [health.benefit_type_id]);

        // Travel Allowance
        await client.query(`
      INSERT INTO employee_benefits (employee_id, benefit_type_id, details, start_date, status)
      VALUES (1, $1, 'Monthly cap: 5000', CURRENT_DATE, 'ACTIVE')
      ON CONFLICT DO NOTHING
    `, [transport.benefit_type_id]);

        await client.query('COMMIT');
        console.log('Benefits seeded for Employee 1');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', e);
    } finally {
        client.release();
        pool.end();
    }
})();
