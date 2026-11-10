const ROLES = [
    { name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Full system access across all modules' },
    { name: 'HR Admin', code: 'HR_ADMIN', description: 'HR operations, recruitment & payroll processing' },
    { name: 'Compliance Officer', code: 'COMPLIANCE_OFFICER', description: 'Labour law, PF, ESIC, licensing & vendor statutory compliance' },
    { name: 'Accounts Team', code: 'ACCOUNTS_TEAM', description: 'Client billing, GST/TDS invoicing & payroll disbursement' },
    { name: 'Site Manager', code: 'SITE_MANAGER', description: 'Site allocation, DPR, procurement, shift scheduling & attendance' },
    { name: 'Employee', code: 'EMPLOYEE', description: 'ESS self-service portal, attendance, leaves & payslips' },
    { name: 'Client Login', code: 'CLIENT_LOGIN', description: 'Client portal for DPRs, procurement tracking, sites & invoices' },
    { name: 'Finance Manager', code: 'FINANCE_MANAGER', description: 'Financial operations, invoicing & approvals' },
    { name: 'Department Manager', code: 'DEPT_MANAGER', description: 'Team management & approvals' }
];

const MODULES = [
    { name: 'Dashboard', code: 'DASHBOARD', description: 'Executive dashboard', order: 1 },
    { name: 'Sites & Shifts', code: 'SITES', description: 'Site & Shift management', order: 2 },
    { name: 'Employee Directory', code: 'EMPLOYEES', description: 'Employee profiles', order: 3 },
    { name: 'Attendance Daily', code: 'ATTENDANCE', description: 'Daily attendance & biometric', order: 4 },
    { name: 'Leave Management', code: 'LEAVES', description: 'Leave applications & balances', order: 5 },
    { name: 'Payroll Processing', code: 'PAYROLL', description: 'Salary generation & slips', order: 6 },
    { name: 'Benefits & Perks', code: 'BENEFITS', description: 'Allowances & Reimbursements', order: 7 },
    { name: 'Statutory & Reports', code: 'REPORTS', description: 'PF, ESI, PT, TDS reports', order: 8 },
    { name: 'User Management', code: 'USERS', description: 'User accounts & RBAC', order: 9 },
    { name: 'System Settings', code: 'SETTINGS', description: 'Global configuration', order: 10 },
    { name: 'Recruitment & Onboarding', code: 'RECRUITMENT', description: 'Requisitions, Interviews, Offers, Onboarding', order: 11 },
    { name: 'Client Master & Invoices', code: 'INVOICES', description: 'Clients, Billing & Invoices', order: 12 },
    { name: 'Vendor Management', code: 'VENDORS', description: 'Vendor compliance, agreements & ratings', order: 13 },
    { name: 'Asset Management', code: 'ASSETS', description: 'Uniforms, helmets, laptops & gear tracking', order: 14 },
    { name: 'Daily Progress Reports', code: 'DPR', description: 'Daily Site Progress Reports & Site Operations Hub', order: 15 },
    { name: 'Procurement Tracker', code: 'PROCUREMENT', description: 'Project material supply chain and manufacturing tracker', order: 16 }
];

const perm = (flags = '') => ({
    can_view: true,
    can_create: flags.includes('C'),
    can_update: flags.includes('U'),
    can_delete: flags.includes('D'),
    can_approve: flags.includes('A'),
    can_export: flags.includes('E')
});

const ROLE_PERMISSION_MATRIX = {
    SUPER_ADMIN: Object.fromEntries(MODULES.map(m => [m.code, perm('CUDAE')])),
    HR_ADMIN: {
        DASHBOARD: perm(''),
        EMPLOYEES: perm('CUDE'),
        RECRUITMENT: perm('CUDAE'),
        SITES: perm('CU'),
        ATTENDANCE: perm('CUDAE'),
        LEAVES: perm('CUDA'),
        PAYROLL: perm('CUAE'),
        BENEFITS: perm('CUA'),
        REPORTS: perm('E'),
        ASSETS: perm('CU'),
        VENDORS: perm(''),
        DPR: perm('E')
    },
    COMPLIANCE_OFFICER: {
        DASHBOARD: perm(''),
        REPORTS: perm('E'),
        EMPLOYEES: perm('E'),
        SITES: perm(''),
        VENDORS: perm('UA'),
        DPR: perm('E'),
        ATTENDANCE: perm('E')
    },
    ACCOUNTS_TEAM: {
        DASHBOARD: perm(''),
        INVOICES: perm('CUAE'),
        PAYROLL: perm('CUAE'),
        BENEFITS: perm('UA'),
        REPORTS: perm('E'),
        VENDORS: perm(''),
        PROCUREMENT: perm('E')
    },
    FINANCE_MANAGER: {
        DASHBOARD: perm(''),
        INVOICES: perm('CUDAE'),
        PAYROLL: perm('CUAE'),
        BENEFITS: perm('UA'),
        REPORTS: perm('E'),
        VENDORS: perm(''),
        ASSETS: perm(''),
        PROCUREMENT: perm('E')
    },
    SITE_MANAGER: {
        DASHBOARD: perm(''),
        ATTENDANCE: perm('CUAE'),
        SITES: perm('U'),
        EMPLOYEES: perm(''),
        LEAVES: perm('CA'),
        DPR: perm('CUDAE'),
        PROCUREMENT: perm('CUE'),
        ASSETS: perm('CU'),
        VENDORS: perm('U')
    },
    DEPT_MANAGER: {
        DASHBOARD: perm(''),
        EMPLOYEES: perm(''),
        ATTENDANCE: perm('CAE'),
        LEAVES: perm('CA'),
        BENEFITS: perm('CA'),
        DPR: perm('CUE'),
        PROCUREMENT: perm('E')
    },
    EMPLOYEE: {
        DASHBOARD: perm(''),
        ATTENDANCE: perm('C'),
        LEAVES: perm('C'),
        PAYROLL: perm('E'),
        BENEFITS: perm('C')
    },
    CLIENT_LOGIN: {
        DASHBOARD: perm(''),
        DPR: perm('E'),
        PROCUREMENT: perm('E'),
        INVOICES: perm('E'),
        SITES: perm('')
    }
};

async function ensureRolesAndModules(pool) {
    for (const r of ROLES) {
        await pool.query(`
            INSERT INTO roles (role_name, role_code, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (role_code) DO UPDATE SET
                role_name = EXCLUDED.role_name,
                description = EXCLUDED.description
        `, [r.name, r.code, r.description]);
    }

    for (const m of MODULES) {
        await pool.query(`
            INSERT INTO modules (module_name, module_code, description, display_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (module_code) DO UPDATE SET
                module_name = EXCLUDED.module_name,
                description = EXCLUDED.description,
                display_order = EXCLUDED.display_order
        `, [m.name, m.code, m.description, m.order]);
    }
}

async function seedDefaultPermissions(pool, { overwriteAll = true } = {}) {
    await ensureRolesAndModules(pool);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const rRes = await client.query('SELECT role_id, role_code FROM roles');
        const mRes = await client.query('SELECT module_id, module_code FROM modules');
        const modMap = Object.fromEntries(mRes.rows.map(m => [m.module_code, m.module_id]));

        for (const role of rRes.rows) {
            const matrix = ROLE_PERMISSION_MATRIX[role.role_code];
            if (!matrix) continue;

            const existingRolePerms = await client.query(
                'SELECT COUNT(*)::int AS cnt FROM permissions WHERE role_id = $1',
                [role.role_id]
            );
            const shouldSyncRole = overwriteAll || role.role_code === 'SUPER_ADMIN' || existingRolePerms.rows[0].cnt === 0;

            if (shouldSyncRole) {
                await client.query('DELETE FROM permissions WHERE role_id = $1', [role.role_id]);
            }

            for (const [modCode, flags] of Object.entries(matrix)) {
                const moduleId = modMap[modCode];
                if (!moduleId) continue;

                if (shouldSyncRole) {
                    await client.query(`
                        INSERT INTO permissions (
                            role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (role_id, module_id) DO UPDATE SET
                            can_view = EXCLUDED.can_view,
                            can_create = EXCLUDED.can_create,
                            can_update = EXCLUDED.can_update,
                            can_delete = EXCLUDED.can_delete,
                            can_approve = EXCLUDED.can_approve,
                            can_export = EXCLUDED.can_export
                    `, [
                        role.role_id,
                        moduleId,
                        flags.can_view,
                        flags.can_create,
                        flags.can_update,
                        flags.can_delete,
                        flags.can_approve,
                        flags.can_export
                    ]);
                } else {
                    await client.query(`
                        INSERT INTO permissions (
                            role_id, module_id, can_view, can_create, can_update, can_delete, can_approve, can_export
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (role_id, module_id) DO NOTHING
                    `, [
                        role.role_id,
                        moduleId,
                        flags.can_view,
                        flags.can_create,
                        flags.can_update,
                        flags.can_delete,
                        flags.can_approve,
                        flags.can_export
                    ]);
                }
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    ROLES,
    MODULES,
    ROLE_PERMISSION_MATRIX,
    ensureRolesAndModules,
    seedDefaultPermissions
};
