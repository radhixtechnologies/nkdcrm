const jwt = require('jsonwebtoken');
const db = require('../config/database');

const getJwtSecret = () => {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '') {
        return process.env.JWT_SECRET;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable must be configured in production.');
    }
    return 'nkd-crm-dev-only-secret';
};

const VALID_ACTIONS = new Set([
    'can_view',
    'can_create',
    'can_update',
    'can_delete',
    'can_approve',
    'can_export'
]);

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : (req.query.token || req.headers['x-access-token'] || null);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication token is required'
        });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    try {
        if (decoded?.userId) {
            const userRes = await db.query(`
                SELECT
                    u.user_id,
                    u.employee_id,
                    u.email,
                    u.role_id,
                    u.is_active,
                    r.role_code,
                    r.role_name,
                    r.is_active AS role_active,
                    e.employee_code,
                    e.first_name,
                    e.last_name,
                    e.full_name,
                    e.site_id,
                    e.employment_status,
                    e.is_active AS emp_active
                FROM users u
                INNER JOIN roles r ON r.role_id = u.role_id
                LEFT JOIN employees e ON e.employee_id = u.employee_id
                WHERE u.user_id = $1
                LIMIT 1
            `, [decoded.userId]);

            if (userRes.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Account not found or session expired'
                });
            }

            const u = userRes.rows[0];
            if (!u.is_active || u.role_active === false) {
                return res.status(401).json({
                    success: false,
                    message: 'This account has been disabled. Please contact your administrator.'
                });
            }

            if (u.employee_id && (u.employment_status === 'TERMINATED' || u.emp_active === false)) {
                return res.status(401).json({
                    success: false,
                    message: 'Employee account is inactive or terminated.'
                });
            }

            req.user = {
                ...decoded,
                userId: u.user_id,
                email: u.email,
                roleId: u.role_id,
                roleCode: (u.role_code || decoded.roleCode || '').toUpperCase(),
                roleName: u.role_name || decoded.roleName || '',
                employeeId: u.employee_id || decoded.employeeId || null,
                employeeCode: u.employee_code || decoded.employeeCode || null,
                firstName: u.first_name || decoded.firstName || null,
                lastName: u.last_name || decoded.lastName || null,
                fullName: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.role_name,
                siteId: u.site_id || null
            };
        } else {
            req.user = {
                ...decoded,
                roleCode: (decoded?.roleCode || '').toUpperCase()
            };
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

const requireRole = (...roleCodes) => (req, res, next) => {
    const normalized = roleCodes.map(c => String(c).toUpperCase());
    const userRole = String(req.user?.roleCode || '').toUpperCase();

    if (!req.user || !normalized.includes(userRole)) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to perform this action'
        });
    }

    return next();
};

const checkUserPermission = async (user, moduleCode, action = 'can_view') => {
    if (!user) return false;
    const roleCode = String(user.roleCode || '').toUpperCase();
    if (roleCode === 'SUPER_ADMIN') return true;
    if (!VALID_ACTIONS.has(action)) return false;

    const query = user.roleId
        ? `
            SELECT p.can_view, p.can_create, p.can_update, p.can_delete, p.can_approve, p.can_export
            FROM permissions p
            INNER JOIN modules m ON m.module_id = p.module_id
            WHERE p.role_id = $1 AND m.module_code = $2
            LIMIT 1
        `
        : `
            SELECT p.can_view, p.can_create, p.can_update, p.can_delete, p.can_approve, p.can_export
            FROM permissions p
            INNER JOIN roles r ON r.role_id = p.role_id
            INNER JOIN modules m ON m.module_id = p.module_id
            WHERE r.role_code = $1 AND m.module_code = $2
            LIMIT 1
        `;

    const param = user.roleId || roleCode;
    const result = await db.query(query, [param, String(moduleCode).toUpperCase()]);
    if (result.rows.length === 0) return false;
    return Boolean(result.rows[0][action]);
};

const requirePermission = (moduleCode, action = 'can_view') => async (req, res, next) => {
    try {
        const allowed = await checkUserPermission(req.user, moduleCode, action);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: `Access denied: missing ${moduleCode}.${action} permission`
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
};

const requireAnyPermission = (...checks) => async (req, res, next) => {
    try {
        for (const item of checks) {
            const [moduleCode, action = 'can_view'] = Array.isArray(item) ? item : String(item).split('.');
            if (await checkUserPermission(req.user, moduleCode, action)) {
                return next();
            }
        }
        return res.status(403).json({
            success: false,
            message: 'Access denied: insufficient permissions'
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    authenticate,
    requireRole,
    requirePermission,
    requireAnyPermission,
    checkUserPermission,
    getJwtSecret
};
