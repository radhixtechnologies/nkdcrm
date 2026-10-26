const db = require('../config/database');

async function debug() {
    try {
        console.log('--- Employees ---');
        const emps = await db.query('SELECT employee_id, employee_code, first_name FROM employees');
        console.table(emps.rows);

        console.log('\n--- Leave Balances ---');
        const bals = await db.query('SELECT * FROM leave_balances');
        console.table(bals.rows);

        console.log('\n--- Test Query for ID 1 ---');
        const test = await db.query('SELECT * FROM leave_balances WHERE employee_id = 1 AND year = 2026');
        console.log('Count:', test.rowCount);
        console.table(test.rows);

    } catch (e) {
        console.error(e);
    }
}

debug();
