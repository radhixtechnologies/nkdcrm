const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate, requireRole, getJwtSecret } = require('../middleware/auth');
const auditService = require('../services/auditService');

const router = express.Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

const getPermissions = async (roleId) => {
    const result = await db.query(`
        SELECT
            m.module_code,
            p.can_view,
            p.can_create,
            p.can_update,
            p.can_delete,
            p.can_approve,
            p.can_export
        FROM permissions p
        INNER JOIN modules m ON m.module_id = p.module_id
        WHERE p.role_id = $1
        ORDER BY m.display_order, m.module_code
    `, [roleId]);

    return result.rows;
};

const getEmployeeSnapshot = async (employeeId) => {
    if (!employeeId) return {};

    try {
        const result = await db.query(`
            SELECT employee_id, employee_code, first_name, last_name, designation, department, site_id
            FROM employees
            WHERE employee_id = $1
        `, [employeeId]);

        if (result.rows.length === 0) return {};

        const employee = result.rows[0];
        return {
            employeeId: employee.employee_id,
            employeeCode: employee.employee_code,
            firstName: employee.first_name,
            lastName: employee.last_name || '',
            designation: employee.designation || null,
            department: employee.department || null,
            siteId: employee.site_id || null
        };
    } catch (error) {
        if (error.code === '42P01') return {};
        throw error;
    }
};

const buildUserPayload = async (userRow) => {
    const employee = await getEmployeeSnapshot(userRow.employee_id);
    const roleWords = String(userRow.role_name || 'Portal User').trim().split(/\s+/);
    const fallbackFirst = roleWords[0] || 'Portal';
    const fallbackLast = roleWords.slice(1).join(' ');

    const firstName = employee.firstName || fallbackFirst;
    const lastName = employee.firstName ? (employee.lastName || '') : fallbackLast;

    return {
        id: userRow.user_id,
        userId: userRow.user_id,
        email: userRow.email,
        employeeId: employee.employeeId || userRow.employee_id || null,
        employeeCode: employee.employeeCode || null,
        firstName,
        lastName,
        designation: employee.designation || null,
        department: employee.department || null,
        siteId: employee.siteId || null,
        roleCode: String(userRow.role_code || '').toUpperCase(),
        roleName: userRow.role_name,
        role: {
            roleId: userRow.role_id,
            roleName: userRow.role_name,
            roleCode: String(userRow.role_code || '').toUpperCase()
        }
    };
};

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const result = await db.query(`
            SELECT
                u.user_id,
                u.employee_id,
                u.email,
                u.password_hash,
                u.role_id,
                u.is_active,
                r.role_name,
                r.role_code,
                e.employment_status,
                e.is_active AS emp_active
            FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
            LEFT JOIN employees e ON e.employee_id = u.employee_id
            WHERE LOWER(u.email) = LOWER($1)
            LIMIT 1
        `, [email.trim()]);

        let userRow;
        if (result.rows.length === 0) {
            // Check if active employee exists in employees table with password_hash
            const empCheck = await db.query(`
                SELECT e.employee_id, e.email, e.password_hash, e.role_id, e.is_active, e.employment_status,
                       r.role_name, r.role_code
                FROM employees e
                LEFT JOIN roles r ON r.role_id = e.role_id
                WHERE LOWER(e.email) = LOWER($1)
                  AND e.password_hash IS NOT NULL
                  AND COALESCE(e.employment_status, 'ACTIVE') <> 'TERMINATED'
                LIMIT 1
            `, [email.trim()]);

            if (empCheck.rows.length > 0) {
                const emp = empCheck.rows[0];
                if (emp.is_active === false) {
                    return res.status(403).json({
                        success: false,
                        message: 'This account is disabled'
                    });
                }

                const matches = await bcrypt.compare(password, emp.password_hash);
                if (!matches) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid email or password'
                    });
                }

                let assignedRoleId = emp.role_id;
                let assignedRoleName = emp.role_name;
                let assignedRoleCode = emp.role_code;
                if (!assignedRoleId) {
                    const defaultRole = await db.query(
                        "SELECT role_id, role_name, role_code FROM roles WHERE role_code = 'EMPLOYEE' LIMIT 1"
                    );
                    if (defaultRole.rows.length === 0) {
                        return res.status(500).json({
                            success: false,
                            message: 'Default EMPLOYEE role is not configured in database'
                        });
                    }
                    assignedRoleId = defaultRole.rows[0].role_id;
                    assignedRoleName = defaultRole.rows[0].role_name;
                    assignedRoleCode = defaultRole.rows[0].role_code;
                }

                // Auto-sync into users table
                const syncRes = await db.query(`
                    INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                    VALUES ($1, $2, $3, $4, TRUE, TRUE)
                    ON CONFLICT (email) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        role_id = EXCLUDED.role_id,
                        employee_id = EXCLUDED.employee_id,
                        is_active = TRUE
                    RETURNING user_id, employee_id, email, password_hash, role_id, is_active
                `, [emp.employee_id, email.trim().toLowerCase(), emp.password_hash, assignedRoleId]);

                userRow = {
                    ...syncRes.rows[0],
                    role_name: assignedRoleName || 'Employee',
                    role_code: assignedRoleCode || 'EMPLOYEE'
                };
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
        } else {
            userRow = result.rows[0];
        }

        if (!userRow.is_active || (userRow.employee_id && (userRow.emp_active === false || userRow.employment_status === 'TERMINATED'))) {
            return res.status(403).json({
                success: false,
                message: 'This account is disabled or terminated'
            });
        }

        const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
            [userRow.user_id]
        );

        const user = await buildUserPayload(userRow);
        const permissions = await getPermissions(userRow.role_id);
        const token = jwt.sign({
            userId: user.userId,
            email: user.email,
            roleCode: user.roleCode,
            employeeId: user.employeeId,
            employeeCode: user.employeeCode
        }, getJwtSecret(), { expiresIn: jwtExpiresIn });

        // Log successful login to Audit Trail
        auditService.logAction({
            req,
            userId: user.userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            userEmail: user.email,
            roleCode: user.roleCode,
            action: 'LOGIN',
            module: 'AUTH',
            recordId: String(user.userId),
            recordTitle: `User Signed In (${user.roleCode})`,
            details: {
                role: user.roleName || user.roleCode,
                employeeCode: user.employeeCode
            }
        }).catch(() => {});

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user,
                permissions
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/me', authenticate, async (req, res, next) => {
    try {
        const userRow = {
            user_id: req.user.userId,
            employee_id: req.user.employeeId,
            email: req.user.email,
            role_id: req.user.roleId,
            role_code: req.user.roleCode,
            role_name: req.user.roleName
        };
        const user = await buildUserPayload(userRow);
        const permissions = req.user.roleId ? await getPermissions(req.user.roleId) : [];
        return res.json({
            success: true,
            data: {
                user,
                permissions
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }
        if (String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters'
            });
        }

        const userRes = await db.query(
            'SELECT user_id, employee_id, password_hash FROM users WHERE user_id = $1 LIMIT 1',
            [req.user.userId]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User account not found' });
        }

        const matches = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
        if (!matches) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(String(newPassword), 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [newHash, req.user.userId]);
        if (userRes.rows[0].employee_id) {
            await db.query(
                'UPDATE employees SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2',
                [newHash, userRes.rows[0].employee_id]
            );
        }

        return res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/roles', authenticate, async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT role_id, role_name, role_code, description
            FROM roles
            WHERE is_active = TRUE
            ORDER BY role_id
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
});

router.post('/register', authenticate, requireRole('SUPER_ADMIN'), async (req, res, next) => {
    try {
        const { email, password, roleId, role_id, employeeId, employee_id } = req.body;
        const selectedRoleId = parseInt(roleId || role_id, 10);
        const selectedEmployeeId = (employeeId || employee_id) ? parseInt(employeeId || employee_id, 10) : null;

        if (!email || !password || !selectedRoleId || Number.isNaN(selectedRoleId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid email, password, and role are required'
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        const roleCheck = await db.query('SELECT role_id FROM roles WHERE role_id = $1', [selectedRoleId]);
        if (roleCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Selected role does not exist'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query(`
            INSERT INTO users (email, password_hash, role_id, employee_id, is_active, is_verified)
            VALUES ($1, $2, $3, $4, TRUE, TRUE)
            RETURNING user_id, email, role_id, employee_id, is_active, created_at
        `, [cleanEmail, passwordHash, selectedRoleId, selectedEmployeeId]);

        if (selectedEmployeeId) {
            await db.query(
                `UPDATE employees SET role_id = $1, password_hash = COALESCE(password_hash, $2), is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $3`,
                [selectedRoleId, passwordHash, selectedEmployeeId]
            );
        }

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists'
            });
        }

        return next(error);
    }
});

module.exports = router;
