const { pool } = require('../config/database');

async function seedRbacRoles() {
    console.log('--- Seeding Comprehensive RBAC Roles & Permissions ---');

    // 1. Ensure all 7 requested roles (plus existing legacy roles) exist
    const rolesToEnsure = [
        { name: 'Super Admin', code: 'SUPER_ADMIN', desc: 'Full system access across all modules' },
        { name: 'HR Admin', code: 'HR_ADMIN', desc: 'HR Operations, Recruitment & Payroll processing' },
        { name: 'Compliance Officer', code: 'COMPLIANCE_OFFICER', desc: 'Statutory compliance, labour law, PF/ESIC & vendor compliance' },
        { name: 'Accounts Team', code: 'ACCOUNTS_TEAM', desc: 'Client billing, GST/TDS invoices & payroll disbursement' },
        { name: 'Site Manager', code: 'SITE_MANAGER', desc: 'Site allocation, staff deployment & biometric/GPS attendance' },
        { name: 'Employee', code: 'EMPLOYEE', desc: 'ESS self-service portal, leaves, payslips & attendance' },
        { name: 'Client Login', code: 'CLIENT_LOGIN', desc: 'Client portal for site reports, deployment & invoices' },
        { name: 'Finance Manager', code: 'FINANCE_MANAGER', desc: 'Financial operations & reporting' },
        { name: 'Department Manager', code: 'DEPT_MANAGER', desc: 'Team management & approvals' }
    ];

    for (const r of rolesToEnsure) {
        await pool.query(
            `INSERT INTO roles (role_name, role_code, description) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (role_code) DO UPDATE SET role_name = $1, description = $3`,
            [r.name, r.code, r.desc]
        );
    }

    // 2. Fetch all modules
    const mRes = await pool.query('SELECT module_id, module_code FROM modules');
    const modMap = {};
    for (const m of mRes.rows) {
        modMap[m.module_code] = m.module_id;
    }

    // 3. Define permission mapping for each role
    const rolePermissions = {
        SUPER_ADMIN: Object.keys(modMap),
        HR_ADMIN: [
            'DASHBOARD', 'EMPLOYEES', 'RECRUITMENT', 'ATTENDANCE', 'LEAVES', 
            'PAYROLL', 'BENEFITS', 'PERKS', 'REIMBURSEMENTS', 'REPORTS', 'SITES', 'ASSETS'
        ],
        COMPLIANCE_OFFICER: [
            'DASHBOARD', 'REPORTS', 'VENDORS', 'EMPLOYEES'
        ],
        ACCOUNTS_TEAM: [
            'DASHBOARD', 'INVOICES', 'PAYROLL', 'REIMBURSEMENTS', 'REPORTS'
        ],
        SITE_MANAGER: [
            'DASHBOARD', 'ATTENDANCE', 'SITES', 'EMPLOYEES', 'LEAVES'
        ],
        EMPLOYEE: [
            'DASHBOARD', 'ATTENDANCE', 'LEAVES', 'PAYROLL', 'BENEFITS', 'PERKS', 'REIMBURSEMENTS'
        ],
        CLIENT_LOGIN: [
            'DASHBOARD', 'REPORTS', 'INVOICES', 'SITES'
        ],
        FINANCE_MANAGER: [
            'DASHBOARD', 'PAYROLL', 'REIMBURSEMENTS', 'REPORTS', 'INVOICES'
        ],
        DEPT_MANAGER: [
            'DASHBOARD', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'REIMBURSEMENTS'
        ]
    };

    // 4. Upsert permissions
    const rRes = await pool.query('SELECT role_id, role_code FROM roles');
    for (const r of rRes.rows) {
        const allowed = rolePermissions[r.role_code] || [];
        for (const modCode of allowed) {
            const modId = modMap[modCode];
            if (!modId) continue;

            const isSuper = r.role_code === 'SUPER_ADMIN';
            const isClient = r.role_code === 'CLIENT_LOGIN';
            const isCompliance = r.role_code === 'COMPLIANCE_OFFICER';

            await pool.query(
                `INSERT INTO permissions (role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export)
                 VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7)
                 ON CONFLICT (role_id, module_id) DO UPDATE SET
                   can_view = TRUE,
                   can_create = EXCLUDED.can_create,
                   can_update = EXCLUDED.can_update,
                   can_delete = EXCLUDED.can_delete,
                   can_approve = EXCLUDED.can_approve,
                   can_export = EXCLUDED.can_export`,
                [
                    r.role_id,
                    modId,
                    isSuper || (!isClient && !isCompliance),
                    isSuper || (!isClient && !isCompliance),
                    isSuper,
                    isSuper || r.role_code.includes('ADMIN') || r.role_code.includes('MANAGER') || r.role_code === 'COMPLIANCE_OFFICER',
                    isSuper || isClient || isCompliance || r.role_code.includes('ADMIN') || r.role_code.includes('ACCOUNT')
                ]
            );
        }
    }

    // 5. Verification output
    const check = await pool.query(`
        SELECT r.role_id, r.role_name, r.role_code, COUNT(p.permission_id) as assigned_modules
        FROM roles r
        LEFT JOIN permissions p ON r.role_id = p.role_id
        GROUP BY r.role_id, r.role_name, r.role_code
        ORDER BY r.role_id
    `);

    console.log('✅ All Roles & Permissions successfully synced:');
    console.table(check.rows);
    process.exit(0);
}

seedRbacRoles().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});

