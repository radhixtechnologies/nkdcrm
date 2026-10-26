const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

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
        ORDER BY m.module_code
    `, [roleId]);

    return result.rows;
};

const getEmployeeSnapshot = async (employeeId) => {
    if (!employeeId) return {};

    try {
        const result = await db.query(`
            SELECT employee_id, employee_code, first_name, last_name
            FROM employees
            WHERE employee_id = $1
        `, [employeeId]);

        if (result.rows.length === 0) return {};

        const employee = result.rows[0];
        return {
            employeeId: employee.employee_id,
            employeeCode: employee.employee_code,
            firstName: employee.first_name,
            lastName: employee.last_name || ''
        };
    } catch (error) {
        if (error.code === '42P01') return {};
        throw error;
    }
};

const buildUserPayload = async (userRow) => {
    const employee = await getEmployeeSnapshot(userRow.employee_id);
    const firstName = employee.firstName || 'System';
    const lastName = employee.lastName || 'Administrator';

    return {
        id: userRow.user_id,
        userId: userRow.user_id,
        email: userRow.email,
        employeeId: employee.employeeId || userRow.employee_id || null,
        employeeCode: employee.employeeCode || null,
        firstName,
        lastName,
        roleCode: userRow.role_code,
        roleName: userRow.role_name,
        role: {
            roleId: userRow.role_id,
            roleName: userRow.role_name,
            roleCode: userRow.role_code
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
                r.role_code
            FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
            WHERE LOWER(u.email) = LOWER($1)
            LIMIT 1
        `, [email.trim()]);

        let userRow;
        if (result.rows.length === 0) {
            // Check if user exists in employees table with password
            const empCheck = await db.query(`
                SELECT e.employee_id, e.email, e.password_hash, e.role_id, e.is_active, r.role_name, r.role_code
                FROM employees e
                LEFT JOIN roles r ON r.role_id = e.role_id
                WHERE LOWER(e.email) = LOWER($1) AND e.password_hash IS NOT NULL
                LIMIT 1
            `, [email.trim()]);

            if (empCheck.rows.length > 0) {
                const emp = empCheck.rows[0];
                const matches = await bcrypt.compare(password, emp.password_hash);
                if (matches) {
                    // Auto-sync into users table
                    const syncRes = await db.query(`
                        INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                        VALUES ($1, $2, $3, COALESCE($4, 5), TRUE, TRUE)
                        ON CONFLICT (email) DO UPDATE
                        SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, employee_id = EXCLUDED.employee_id, is_active = TRUE
                        RETURNING user_id, employee_id, email, password_hash, role_id, is_active
                    `, [emp.employee_id, email.trim().toLowerCase(), emp.password_hash, emp.role_id]);

                    userRow = {
                        ...syncRes.rows[0],
                        role_name: emp.role_name || 'Employee',
                        role_code: emp.role_code || 'EMPLOYEE'
                    };
                } else {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid email or password'
                    });
                }
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
        } else {
            userRow = result.rows[0];
        }

        if (!userRow.is_active) {
            return res.status(403).json({
                success: false,
                message: 'This account is disabled'
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
        }, jwtSecret, { expiresIn: jwtExpiresIn });

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

router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
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
        const selectedRoleId = roleId || role_id;
        const selectedEmployeeId = employeeId || employee_id || null;

        if (!email || !password || !selectedRoleId) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and role are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await db.query(`
            INSERT INTO users (email, password_hash, role_id, employee_id, is_active, is_verified)
            VALUES ($1, $2, $3, $4, TRUE, TRUE)
            RETURNING user_id, email, role_id, employee_id, is_active, created_at
        `, [email.trim().toLowerCase(), passwordHash, selectedRoleId, selectedEmployeeId]);

        res.status(201).json({
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

        next(error);
    }
});

module.exports = router;
