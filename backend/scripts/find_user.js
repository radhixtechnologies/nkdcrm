const db = require('../config/database');

async function findCharu() {
    try {
        const res = await db.query("SELECT * FROM employees WHERE first_name ILIKE '%charu%' OR last_name ILIKE '%sarswat%' OR email ILIKE '%charu%' OR employee_code ILIKE '%charu%'");
        console.log('Found users:', res.rows.map(e => `${e.employee_code}: ${e.first_name} ${e.last_name} (${e.email})`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findCharu();
