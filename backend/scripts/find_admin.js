const db = require('../config/database');

async function findAdmin() {
    try {
        const res = await db.query("SELECT * FROM employees WHERE first_name ILIKE '%System%' OR last_name ILIKE '%Administrator%'");
        console.log('Found admins:', res.rows.map(e => `${e.employee_code}: ${e.first_name} ${e.last_name}`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findAdmin();
