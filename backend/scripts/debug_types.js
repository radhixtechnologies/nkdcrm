const db = require('../config/database');

async function debug() {
    try {
        console.log('--- Leave Types ---');
        const types = await db.query('SELECT * FROM leave_types');
        console.table(types.rows);

        console.log('\n--- Leave Balances (All) ---');
        const bals = await db.query('SELECT * FROM leave_balances');
        console.table(bals.rows);
    } catch (e) {
        console.error(e);
    }
}

debug();
