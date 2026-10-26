const db = require('../config/database');

async function force() {
    try {
        console.log('Inserting balance...');
        const res = await db.query(`
            INSERT INTO leave_balances (employee_id, leave_type_id, year, opening_balance, balance)
            VALUES (1, 1, 2026, 12, 12)
            ON CONFLICT (employee_id, leave_type_id, year) 
            DO UPDATE SET balance = 12
            RETURNING *
        `);
        console.log('Inserted:', res.rows[0]);

        console.log('Reading back...');
        const check = await db.query('SELECT * FROM leave_balances');
        console.log('Total rows:', check.rowCount);
        console.table(check.rows);
    } catch (e) {
        console.error(e);
    }
}

force();
