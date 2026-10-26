const db = require('../config/database');

async function inspect() {
    try {
        const sitesRes = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sites'");
        console.log('--- SITES COLUMNS ---');
        console.log(sitesRes.rows.map(r => r.column_name).join(', '));

        const empRes = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees'");
        console.log('--- EMPLOYEES COLUMNS ---');
        console.log(empRes.rows.map(r => r.column_name).join(', '));

        process.exit(0);
    } catch (err) {
        console.error('Inspection failed:', err);
        process.exit(1);
    }
}

inspect();

