const express = require('express');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT
                u.user_id,
                u.employee_id,
                u.email,
                u.role_id,
                u.is_active,
                u.is_verified,
                u.last_login,
                u.created_at,
                r.role_name,
                r.role_code,
                e.employee_code,
                e.first_name,
                e.last_name,
                e.designation,
                e.department
            FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
            LEFT JOIN employees e ON e.employee_id = u.employee_id
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
});

router.get('/roles', async (req, res, next) => {
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

router.put('/:userId/role', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const selectedRoleId = parseInt(req.body.roleId || req.body.role_id, 10);

        if (Number.isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        if (!selectedRoleId || Number.isNaN(selectedRoleId)) {
            return res.status(400).json({ success: false, message: 'Valid role is required' });
        }

        const roleRes = await db.query('SELECT role_id, role_code, role_name FROM roles WHERE role_id = $1', [selectedRoleId]);
        if (roleRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Selected role not found' });
        }

        if (userId === req.user.userId && roleRes.rows[0].role_code !== 'SUPER_ADMIN') {
            return res.status(400).json({
                success: false,
                message: 'You cannot demote your own currently active Super Admin account'
            });
        }

        const result = await db.query(`
            UPDATE users
            SET role_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING user_id, employee_id, email, role_id
        `, [selectedRoleId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (result.rows[0].employee_id) {
            await db.query(
                'UPDATE employees SET role_id = $1, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2',
                [selectedRoleId, result.rows[0].employee_id]
            );
        }

        return res.json({
            success: true,
            message: 'Role updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
});

router.put('/:userId/status', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { isActive, is_active } = req.body;
        const nextStatus = typeof isActive === 'boolean' ? isActive : is_active;

        if (Number.isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        if (typeof nextStatus !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Active status boolean is required' });
        }

        if (userId === req.user.userId && nextStatus === false) {
            return res.status(400).json({
                success: false,
                message: 'You cannot disable your own active administrator account'
            });
        }

        const result = await db.query(`
            UPDATE users
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING user_id, employee_id, email, is_active
        `, [nextStatus, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (result.rows[0].employee_id) {
            await db.query(
                'UPDATE employees SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2',
                [nextStatus, result.rows[0].employee_id]
            );
        }

        return res.json({
            success: true,
            message: 'User status updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
