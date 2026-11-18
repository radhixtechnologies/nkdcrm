const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const recycleBinService = require('../services/recycleBinService');
const { authenticate, requireRole } = require('../middleware/auth');

// All audit & recycle routes require authentication
router.use(authenticate);

// ==================== AUDIT LOGS ENDPOINTS ==================== //

/**
 * GET /api/audit-logs
 * Fetch paginated audit trail logs with module, action, date, and user filters
 */
router.get('/audit-logs', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            module = 'ALL',
            action = 'ALL',
            userId = null,
            search = '',
            startDate = null,
            endDate = null
        } = req.query;

        const result = await auditService.getLogs({
            page,
            limit,
            module,
            action,
            userId,
            search,
            startDate,
            endDate
        });

        return res.json({
            success: true,
            data: result.logs,
            pagination: result.pagination
        });
    } catch (err) {
        console.error('Audit logs route error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit-logs/stats
 * Get activity analytics for dashboard widgets
 */
router.get('/audit-logs/stats', async (req, res) => {
    try {
        const stats = await auditService.getStats();
        return res.json({ success: true, data: stats });
    } catch (err) {
        console.error('Audit stats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch audit statistics' });
    }
});

/**
 * GET /api/audit-logs/recent
 * Get recent activity feed (default 10 items)
 */
router.get('/audit-logs/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const recent = await auditService.getRecent(limit);
        return res.json({ success: true, data: recent });
    } catch (err) {
        console.error('Audit recent logs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch recent audit logs' });
    }
});

// ==================== RECYCLE BIN ENDPOINTS ==================== //

/**
 * GET /api/recycle-bin
 * Fetch un-restored deleted items with module filter and search
 */
router.get('/recycle-bin', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            module = 'ALL',
            search = ''
        } = req.query;

        const result = await recycleBinService.getItems({
            page,
            limit,
            module,
            search
        });

        return res.json({
            success: true,
            data: result.items,
            pagination: result.pagination
        });
    } catch (err) {
        console.error('Recycle bin getItems error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch recycle bin items' });
    }
});

/**
 * GET /api/recycle-bin/stats
 * Get trash count and breakdown
 */
router.get('/recycle-bin/stats', async (req, res) => {
    try {
        const stats = await recycleBinService.getBinStats();
        return res.json({ success: true, data: stats });
    } catch (err) {
        console.error('Recycle bin stats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch recycle bin stats' });
    }
});

/**
 * POST /api/recycle-bin/:id/restore
 * 1-Click Restore item back to active database
 */
router.post('/recycle-bin/:id/restore', async (req, res) => {
    try {
        const binId = parseInt(req.params.id, 10);
        if (!binId) {
            return res.status(400).json({ success: false, message: 'Invalid recycle bin ID' });
        }

        const result = await recycleBinService.restoreItem(binId, { req, user: req.user });
        return res.json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (err) {
        console.error('Recycle bin restore error:', err);
        return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to restore item' });
    }
});

/**
 * DELETE /api/recycle-bin/:id/permanent
 * Permanently erase item from Recycle Bin (Super Admin only)
 */
router.delete('/recycle-bin/:id/permanent', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const binId = parseInt(req.params.id, 10);
        if (!binId) {
            return res.status(400).json({ success: false, message: 'Invalid recycle bin ID' });
        }

        const result = await recycleBinService.permanentlyDelete(binId, { req, user: req.user });
        return res.json({
            success: true,
            message: result.message
        });
    } catch (err) {
        console.error('Recycle bin permanent delete error:', err);
        return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to permanently delete item' });
    }
});

module.exports = router;
