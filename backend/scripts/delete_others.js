const db = require('../config/database');

async function deleteOthers() {
    try {
        console.log('Starting bulk removal of employees...');

        // Define the "Safe List" of Employee Codes
        const keepCodes = ['ADMIN001', 'EMP-000008'];
        const keepEmails = ['charusarswat639649@gmail.com', 'admin@nkd.com']; // If user's email is distinct

        // Find employees to delete
        const findRes = await db.query(`
            SELECT employee_id, employee_code, first_name 
            FROM employees 
            WHERE employee_code NOT IN ($1, $2)
        `, keepCodes);
        const idsToDelete = findRes.rows.map(r => r.employee_id);

        if (idsToDelete.length === 0) {
            console.log('No employees found to delete.');
            process.exit(0);
        }

        console.log(`Found ${idsToDelete.length} employees to delete.`);

        // Helper to safe delete
        const safeDelete = async (table, col) => {
            try {
                const res = await db.query(`DELETE FROM "${table}" WHERE "${col}" = ANY($1)`, [idsToDelete]);
                console.log(`Deleted ${res.rowCount} rows from ${table}`);
            } catch (err) {
                console.error(`Failed to delete from ${table}: ${err.message}`);
            }
        };

        // Delete dependents
        await safeDelete('attendance_daily', 'employee_id');
        await safeDelete('attendance_records', 'employee_id');
        await safeDelete('leave_balances', 'employee_id');
        await safeDelete('leave_requests', 'employee_id');
        await safeDelete('salary_slips', 'employee_id');
        await safeDelete('leave_balance_logs', 'employee_id');
        await safeDelete('employee_benefits', 'employee_id');
        await safeDelete('employee_documents', 'employee_id');
        await safeDelete('employee_perks', 'employee_id');
        await safeDelete('salaries', 'employee_id');
        await safeDelete('salary_components', 'employee_id');
        await safeDelete('resignations', 'employee_id');
        await safeDelete('users', 'employee_id');

        // Finally Delete Employees
        try {
            // Use array param for ANY($1)
            const deleteRes = await db.query(`DELETE FROM employees WHERE employee_id = ANY($1) RETURNING employee_code`, [idsToDelete]);
            console.log(`Successfully deleted ${deleteRes.rowCount} employees.`);
        } catch (err) {
            console.error(`Failed to delete employees: ${err.message}`);
            if (err.detail) console.error(`Detail: ${err.detail}`);
        }

        process.exit(0);

    } catch (error) {
        console.error('Delete failed:', error);
        process.exit(1);
    }
}

deleteOthers();
