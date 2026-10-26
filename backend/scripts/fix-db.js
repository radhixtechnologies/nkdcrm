const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runFix = async () => {
    try {
        const fixFile = path.join(__dirname, '../../database/migrations/999_fix_leave_balances.sql');
        console.log(`Running fix script: ${fixFile}`);

        if (!fs.existsSync(fixFile)) {
            console.error('❌ Fix file not found!');
            process.exit(1);
        }

        const sql = fs.readFileSync(fixFile, 'utf8');
        await pool.query(sql);

        console.log('✅ Fix executed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Fix failed:', err);
        process.exit(1);
    }
};

runFix();
