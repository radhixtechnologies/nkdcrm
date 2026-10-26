const db = require('../config/database');

async function seed() {
    try {
        console.log('Seeding balances for Emp 1...');

        // 1. Clear existing
        await db.query('DELETE FROM leave_balances WHERE employee_id = 1 AND year = 2026');

        // 2. Insert defaults
        const balances = [
            { id: 1, val: 12 }, // CL
            { id: 2, val: 7 },  // SL
            { id: 3, val: 15 }, // PL
            { id: 4, val: 0 }   // LOP
        ];

        for (const b of balances) {
            await db.query(`
                INSERT INTO leave_balances (employee_id, leave_type_id, year, opening_balance, balance)
                VALUES (1, $1, 2026, $2, $2)
            `, [b.id, b.val]);
            console.log(`Inserted type ${b.id}: ${b.val}`);
        }

        console.log('Done.');
    } catch (e) {
        console.error(e);
    }
}

seed();
