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
        console.log('Seeding pending reimbursement...');
        await client.query('BEGIN');

        // Get Benefit Type ID for Travel Allowance
        const typeRes = await client.query("SELECT benefit_type_id FROM benefit_types WHERE name = 'Travel Allowance'");
        if (typeRes.rows.length === 0) {
            console.log('Travel Allowance benefit type not found. Run previous migration.');
            return;
        }
        const benefitTypeId = typeRes.rows[0].benefit_type_id;

        // Insert Pending Claim
        const res = await client.query(`
        INSERT INTO reimbursements 
        (employee_id, benefit_type_id, amount, description, status, claim_date)
        VALUES (1, $1, 2500, 'Client Site Visit - Taxi Logic', 'PENDING', CURRENT_DATE)
        RETURNING claim_id
    `, [benefitTypeId]);

        await client.query('COMMIT');
        console.log(`Seeded pending claim ID: ${res.rows[0].claim_id}`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', e);
    } finally {
        client.release();
        pool.end();
    }
})();
