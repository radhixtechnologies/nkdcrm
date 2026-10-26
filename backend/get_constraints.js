const db = require('./config/database');
const fs = require('fs');
async function run() {
    try {
        const r = await db.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'leave_applications'::regclass");
        fs.writeFileSync('constraints_output.json', JSON.stringify(r.rows, null, 2));
        console.log('Results written to constraints_output.json');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
