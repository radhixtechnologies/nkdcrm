const { pool } = require('./config/database');

const run = async () => {
    try {
        const employeeCode = 'EMP-000005';
        console.log(`Checking for ${employeeCode}...`);

        // Get Employee ID
        const empRes = await pool.query("SELECT employee_id FROM employees WHERE employee_code = $1", [employeeCode]);
        if (!empRes.rows.length) { console.log('Employee not found'); return; }
        const employeeId = empRes.rows[0].employee_id;
        console.log(`Employee ID: ${employeeId}`);

        // Check Balances
        console.log('\n-- Balances --');
        const balRes = await pool.query(`
            SELECT lt.leave_code, lb.year, (lb.opening_balance + lb.earned - lb.taken) as available
            FROM leave_balances lb
            JOIN leave_types lt ON lb.leave_type_id = lt.leave_type_id
            WHERE lb.employee_id = $1
        `, [employeeId]);
        console.log('BALANCES:', JSON.stringify(balRes.rows));

        // Check Requests
        const reqRes = await pool.query(`
            SELECT request_id, from_date, to_date, status 
            FROM leave_requests 
            WHERE employee_id = $1 AND status IN ('PENDING', 'APPROVED')
        `, [employeeId]);
        console.log('REQUESTS:', JSON.stringify(reqRes.rows));

        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
};
run();
