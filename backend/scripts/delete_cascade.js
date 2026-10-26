const db = require('../config/database');

async function cascadeDelete() {
    try {
        console.log('Finding tables referencing employees...');

        // Find tables with FK to employees.employee_id
        const refQuery = `
            SELECT
                tc.table_name, 
                kcu.column_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = 'employees'
            AND ccu.column_name = 'employee_id';
        `;

        const refs = await db.query(refQuery);
        console.log('Found dependent tables:', refs.rows.map(r => `${r.table_name}.${r.column_name}`));

        const idsToDeleteRes = await db.query(`
            SELECT employee_id 
            FROM employees 
            WHERE employee_code NOT IN ('ADMIN001', 'EMP-000008')
            AND (email IS NULL OR email NOT ILIKE '%charusaraswat%')
        `);
        const ids = idsToDeleteRes.rows.map(r => r.employee_id);

        if (ids.length === 0) {
            console.log('No employees to delete.');
            process.exit(0);
        }

        console.log(`Deleting ${ids.length} employees from dependencies...`);

        // Iterate and delete
        for (const row of refs.rows) {
            const table = row.table_name;
            const col = row.column_name;
            try {
                // Check if table has rows to delete (optional, just delete)
                const del = await db.query(`DELETE FROM "${table}" WHERE "${col}" = ANY($1)`, [ids]);
                console.log(`Deleted ${del.rowCount} rows from ${table}`);
            } catch (err) {
                console.error(`Failed on ${table}: ${err.message}`);
                // Continue best effort
            }
        }

        // Finally Employees
        const delEmp = await db.query(`DELETE FROM employees WHERE employee_id = ANY($1)`, [ids]);
        console.log(`Deleted ${delEmp.rowCount} employees.`);

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

cascadeDelete();
