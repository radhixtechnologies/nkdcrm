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
                r.role_code
            FROM users u
            INNER JOIN roles r ON r.role_id = u.role_id
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
        const { userId } = req.params;
        const { roleId, role_id } = req.body;
        const selectedRoleId = roleId || role_id;

        if (!selectedRoleId) {
            return res.status(400).json({
                success: false,
                message: 'Role is required'
            });
        }

        const result = await db.query(`
            UPDATE users
            SET role_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING user_id, email, role_id
        `, [selectedRoleId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Role updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:userId/status', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { isActive, is_active } = req.body;
        const nextStatus = typeof isActive === 'boolean' ? isActive : is_active;

        if (typeof nextStatus !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Active status is required'
            });
        }

        const result = await db.query(`
            UPDATE users
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING user_id, email, is_active
        `, [nextStatus, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User status updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
