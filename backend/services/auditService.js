const db = require('../config/database');

class AuditService {
    /**
     * Ensure audit_logs table exists
     */
    async ensureAuditTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id SERIAL PRIMARY KEY,
                user_id INTEGER,
                user_name VARCHAR(150),
                user_email VARCHAR(150),
                role_code VARCHAR(50),
                action VARCHAR(50) NOT NULL,
                module VARCHAR(50) NOT NULL,
                record_id VARCHAR(100),
                record_title VARCHAR(255),
                details JSONB DEFAULT '{}'::jsonb,
                ip_address VARCHAR(100),
                user_agent TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        `;
        try {
            await db.query(query);
        } catch (err) {
            console.error('AuditService table check error:', err.message);
        }
    }

    /**
     * Log an action to audit trail
     */
    async logAction({
        req = null,
        userId = null,
        userName = null,
        userEmail = null,
        roleCode = null,
        action = 'UPDATE',
        module = 'SYSTEM',
        recordId = null,
        recordTitle = null,
        details = {},
        ipAddress = null,
        userAgent = null
    }) {
        try {
            // Extract from request context if provided
            let finalUserId = userId;
            let finalUserName = userName;
            let finalUserEmail = userEmail;
            let finalRoleCode = roleCode;
            let finalIp = ipAddress;
            let finalUserAgent = userAgent;

            if (req) {
                const u = req.user || {};
                finalUserId = finalUserId ?? u.userId ?? u.user_id ?? null;
                finalUserEmail = finalUserEmail ?? u.email ?? null;
                finalRoleCode = finalRoleCode ?? (u.roleCode || u.role?.roleCode || (typeof u.role === 'string' ? u.role : '') || null);
                
                const firstName = u.firstName || u.first_name || '';
                const lastName = u.lastName || u.last_name || '';
                finalUserName = finalUserName ?? (u.name || u.fullName || `${firstName} ${lastName}`.trim() || finalUserEmail || 'System User');

                finalIp = finalIp ?? (
                    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.socket?.remoteAddress ||
                    req.ip ||
                    '127.0.0.1'
                );
                finalUserAgent = finalUserAgent ?? (req.headers['user-agent'] || 'Direct Client');
            }

            // Ensure details is clean JSON object
            let cleanDetails = details;
            if (typeof cleanDetails === 'string') {
                try {
                    cleanDetails = JSON.parse(cleanDetails);
                } catch (_) {
                    cleanDetails = { note: cleanDetails };
                }
            } else if (!cleanDetails || typeof cleanDetails !== 'object') {
                cleanDetails = {};
            }

            const insertQuery = `
                INSERT INTO audit_logs (
                    user_id, user_name, user_email, role_code,
                    action, module, record_id, record_title,
                    details, ip_address, user_agent, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
                RETURNING *
            `;

            const values = [
                finalUserId ? parseInt(finalUserId, 10) : null,
                finalUserName ? String(finalUserName).slice(0, 150) : 'System',
                finalUserEmail ? String(finalUserEmail).slice(0, 150) : null,
                finalRoleCode ? String(finalRoleCode).slice(0, 50).toUpperCase() : 'USER',
                String(action).toUpperCase(),
                String(module).toUpperCase(),
                recordId ? String(recordId).slice(0, 100) : null,
                recordTitle ? String(recordTitle).slice(0, 255) : null,
                JSON.stringify(cleanDetails),
                finalIp ? String(finalIp).slice(0, 100) : 'unknown',
                finalUserAgent ? String(finalUserAgent).slice(0, 500) : null
            ];

            const res = await db.query(insertQuery, values);
            return res.rows[0];
        } catch (err) {
            // Audit logging should never crash the main application flow
            console.warn('⚠️ Audit log insert non-fatal warning:', err.message);
            return null;
        }
    }

    /**
     * Get paginated audit logs with search and filters
     */
    async getLogs({
        page = 1,
        limit = 25,
        module = 'ALL',
        action = 'ALL',
        userId = null,
        search = '',
        startDate = null,
        endDate = null
    } = {}) {
        await this.ensureAuditTable();

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const params = [];
        let pIndex = 1;

        if (module && module !== 'ALL') {
            conditions.push(`module = $${pIndex++}`);
            params.push(module.toUpperCase());
        }

        if (action && action !== 'ALL') {
            conditions.push(`action = $${pIndex++}`);
            params.push(action.toUpperCase());
        }

        if (userId) {
            conditions.push(`user_id = $${pIndex++}`);
            params.push(parseInt(userId, 10));
        }

        if (startDate) {
            conditions.push(`created_at >= $${pIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`created_at <= $${pIndex++}`);
            params.push(`${endDate} 23:59:59`);
        }

        if (search && search.trim()) {
            const term = `%${search.trim().toLowerCase()}%`;
            conditions.push(`(
                LOWER(user_name) LIKE $${pIndex} OR
                LOWER(user_email) LIKE $${pIndex} OR
                LOWER(record_title) LIKE $${pIndex} OR
                LOWER(record_id) LIKE $${pIndex} OR
                LOWER(module) LIKE $${pIndex} OR
                LOWER(action) LIKE $${pIndex}
            )`);
            params.push(term);
            pIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`;
        const countRes = await db.query(countQuery, params);
        const total = parseInt(countRes.rows[0]?.total || 0, 10);

        const dataQuery = `
            SELECT * FROM audit_logs
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${pIndex++} OFFSET $${pIndex++}
        `;
        const dataRes = await db.query(dataQuery, [...params, limitNum, offset]);

        return {
            logs: dataRes.rows,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1
            }
        };
    }

    /**
     * Get real-time stats for the dashboard widget
     */
    async getStats() {
        await this.ensureAuditTable();

        const todayQuery = `
            SELECT COUNT(*) AS today_count 
            FROM audit_logs 
            WHERE created_at >= CURRENT_DATE
        `;
        const actionBreakdownQuery = `
            SELECT action, COUNT(*) AS count 
            FROM audit_logs 
            GROUP BY action 
            ORDER BY count DESC
        `;
        const moduleBreakdownQuery = `
            SELECT module, COUNT(*) AS count 
            FROM audit_logs 
            GROUP BY module 
            ORDER BY count DESC 
            LIMIT 8
        `;
        const activeUsersQuery = `
            SELECT user_name, user_email, role_code, COUNT(*) AS action_count
            FROM audit_logs
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY user_name, user_email, role_code
            ORDER BY action_count DESC
            LIMIT 5
        `;

        const [todayRes, actionRes, moduleRes, usersRes] = await Promise.all([
            db.query(todayQuery).catch(() => ({ rows: [{ today_count: 0 }] })),
            db.query(actionBreakdownQuery).catch(() => ({ rows: [] })),
            db.query(moduleBreakdownQuery).catch(() => ({ rows: [] })),
            db.query(activeUsersQuery).catch(() => ({ rows: [] }))
        ]);

        return {
            todayCount: parseInt(todayRes.rows[0]?.today_count || 0, 10),
            actionBreakdown: actionRes.rows,
            moduleBreakdown: moduleRes.rows,
            topUsers: usersRes.rows
        };
    }

    /**
     * Get recent logs (for dashboard feed)
     */
    async getRecent(limit = 10) {
        await this.ensureAuditTable();
        const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const query = `
            SELECT * FROM audit_logs
            ORDER BY created_at DESC
            LIMIT $1
        `;
        const res = await db.query(query, [safeLimit]);
        return res.rows;
    }
}

module.exports = new AuditService();
