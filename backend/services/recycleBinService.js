const db = require('../config/database');
const auditService = require('./auditService');

class RecycleBinService {
    /**
     * Ensure recycle_bin table exists
     */
    async ensureRecycleBinTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS recycle_bin (
                bin_id SERIAL PRIMARY KEY,
                module VARCHAR(50) NOT NULL,
                record_id VARCHAR(100) NOT NULL,
                record_title VARCHAR(255) NOT NULL,
                record_data JSONB NOT NULL,
                deleted_by_id INTEGER,
                deleted_by_name VARCHAR(150),
                deleted_by_email VARCHAR(150),
                deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_restored BOOLEAN NOT NULL DEFAULT FALSE,
                restored_at TIMESTAMP,
                restored_by_id INTEGER,
                restored_by_name VARCHAR(150)
            );
            CREATE INDEX IF NOT EXISTS idx_recycle_bin_module ON recycle_bin(module);
            CREATE INDEX IF NOT EXISTS idx_recycle_bin_deleted_at ON recycle_bin(deleted_at DESC);
            CREATE INDEX IF NOT EXISTS idx_recycle_bin_is_restored ON recycle_bin(is_restored);
        `;
        try {
            await db.query(query);
        } catch (err) {
            console.error('RecycleBinService table check error:', err.message);
        }
    }

    /**
     * Archive any deleted entity into Recycle Bin & create audit log entry
     */
    async moveToBin({
        module = 'GENERAL',
        recordId,
        recordTitle,
        recordData = {},
        req = null,
        user = null
    }) {
        await this.ensureRecycleBinTable();

        const u = user || req?.user || {};
        const userId = u.userId ?? u.user_id ?? null;
        const userEmail = u.email ?? null;
        const firstName = u.firstName || u.first_name || '';
        const lastName = u.lastName || u.last_name || '';
        const userName = u.name || u.fullName || `${firstName} ${lastName}`.trim() || userEmail || 'System';
        const roleCode = u.roleCode || u.role?.roleCode || (typeof u.role === 'string' ? u.role : '') || 'USER';

        const insertQuery = `
            INSERT INTO recycle_bin (
                module, record_id, record_title, record_data,
                deleted_by_id, deleted_by_name, deleted_by_email,
                deleted_at, is_restored
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, FALSE)
            RETURNING *
        `;

        const values = [
            String(module).toUpperCase(),
            String(recordId || 'UNKNOWN'),
            String(recordTitle || `Item #${recordId}`),
            JSON.stringify(recordData || {}),
            userId ? parseInt(userId, 10) : null,
            userName,
            userEmail
        ];

        const res = await db.query(insertQuery, values);
        const binEntry = res.rows[0];

        // Automatically write to Audit Logs
        await auditService.logAction({
            req,
            userId,
            userName,
            userEmail,
            roleCode,
            action: 'DELETE',
            module: String(module).toUpperCase(),
            recordId: String(recordId),
            recordTitle: String(recordTitle || `Item #${recordId}`),
            details: {
                bin_id: binEntry.bin_id,
                message: `Moved to Recycle Bin by ${userName}`,
                summary: recordData
            }
        });

        return binEntry;
    }

    /**
     * Get un-restored items currently in Recycle Bin
     */
    async getItems({
        page = 1,
        limit = 20,
        module = 'ALL',
        search = ''
    } = {}) {
        await this.ensureRecycleBinTable();

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNum - 1) * limitNum;

        const conditions = ['is_restored = FALSE'];
        const params = [];
        let pIndex = 1;

        if (module && module !== 'ALL') {
            conditions.push(`module = $${pIndex++}`);
            params.push(module.toUpperCase());
        }

        if (search && search.trim()) {
            const term = `%${search.trim().toLowerCase()}%`;
            conditions.push(`(
                LOWER(record_title) LIKE $${pIndex} OR
                LOWER(record_id) LIKE $${pIndex} OR
                LOWER(deleted_by_name) LIKE $${pIndex} OR
                LOWER(module) LIKE $${pIndex}
            )`);
            params.push(term);
            pIndex++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const countQuery = `SELECT COUNT(*) AS total FROM recycle_bin ${whereClause}`;
        const countRes = await db.query(countQuery, params);
        const total = parseInt(countRes.rows[0]?.total || 0, 10);

        const dataQuery = `
            SELECT * FROM recycle_bin
            ${whereClause}
            ORDER BY deleted_at DESC
            LIMIT $${pIndex++} OFFSET $${pIndex++}
        `;
        const dataRes = await db.query(dataQuery, [...params, limitNum, offset]);

        return {
            items: dataRes.rows,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1
            }
        };
    }

    /**
     * Get recycle bin statistics
     */
    async getBinStats() {
        await this.ensureRecycleBinTable();

        const totalQuery = `SELECT COUNT(*) AS active_trash_count FROM recycle_bin WHERE is_restored = FALSE`;
        const moduleBreakdownQuery = `
            SELECT module, COUNT(*) AS count 
            FROM recycle_bin 
            WHERE is_restored = FALSE 
            GROUP BY module 
            ORDER BY count DESC
        `;

        const [totRes, modRes] = await Promise.all([
            db.query(totalQuery).catch(() => ({ rows: [{ active_trash_count: 0 }] })),
            db.query(moduleBreakdownQuery).catch(() => ({ rows: [] }))
        ]);

        return {
            activeTrashCount: parseInt(totRes.rows[0]?.active_trash_count || 0, 10),
            byModule: modRes.rows
        };
    }

    /**
     * Restore an item from Recycle Bin back to its active state
     */
    async restoreItem(binId, { req = null, user = null } = {}) {
        await this.ensureRecycleBinTable();

        const itemRes = await db.query('SELECT * FROM recycle_bin WHERE bin_id = $1', [binId]);
        if (itemRes.rows.length === 0) {
            const err = new Error('Recycle bin item not found');
            err.status = 404;
            throw err;
        }

        const item = itemRes.rows[0];
        if (item.is_restored) {
            const err = new Error('This item has already been restored.');
            err.status = 400;
            throw err;
        }

        const u = user || req?.user || {};
        const userId = u.userId ?? u.user_id ?? null;
        const userEmail = u.email ?? null;
        const firstName = u.firstName || u.first_name || '';
        const lastName = u.lastName || u.last_name || '';
        const userName = u.name || u.fullName || `${firstName} ${lastName}`.trim() || userEmail || 'Administrator';
        const roleCode = u.roleCode || u.role?.roleCode || (typeof u.role === 'string' ? u.role : '') || 'SUPER_ADMIN';

        const data = item.record_data || {};
        const mod = (item.module || '').toUpperCase();

        // 1. Module-Specific Table Restorations
        if (mod === 'EMPLOYEES') {
            const empId = parseInt(item.record_id, 10);
            // Restore original employee code (strip _DEL_...)
            const originalCode = data.employee_code
                ? data.employee_code.replace(/_DEL_\d+$/, '')
                : null;

            if (empId) {
                await db.query(`
                    UPDATE employees
                    SET employment_status = 'ACTIVE',
                        is_active = TRUE,
                        employee_code = COALESCE($2, employee_code),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE employee_id = $1
                `, [empId, originalCode]);

                // Reactivate login if user account exists
                await db.query(`
                    UPDATE users
                    SET is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE employee_id = $1
                `, [empId]);
            }
        } else if (mod === 'INVOICES') {
            const invId = parseInt(item.record_id, 10);
            const exists = await db.query('SELECT invoice_id FROM invoices WHERE invoice_id = $1', [invId]);
            if (exists.rows.length === 0 && data.invoice_number) {
                // Re-insert deleted invoice
                await db.query(`
                    INSERT INTO invoices (
                        invoice_id, invoice_number, invoice_date, client_id, site_id,
                        po_number, po_date, work_description, gross_amount,
                        taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount,
                        tds_rate, tds_amount, net_receivable, payment_status, status, items
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        $6, $7, $8, $9,
                        $10, $11, $12, $13, $14, $15,
                        $16, $17, $18, $19, $20, $21
                    )
                    ON CONFLICT (invoice_id) DO UPDATE SET status = 'ACTIVE'
                `, [
                    invId, data.invoice_number, data.invoice_date, data.client_id, data.site_id,
                    data.po_number, data.po_date, data.work_description, data.gross_amount || 0,
                    data.taxable_amount || 0, data.gst_rate || 18, data.cgst_amount || 0, data.sgst_amount || 0, data.igst_amount || 0, data.total_amount || 0,
                    data.tds_rate || 2, data.tds_amount || 0, data.net_receivable || 0, data.payment_status || 'Pending', 'ACTIVE', JSON.stringify(data.items || [])
                ]);
            } else if (exists.rows.length > 0) {
                await db.query("UPDATE invoices SET status = 'ACTIVE' WHERE invoice_id = $1", [invId]);
            }
        } else if (mod === 'VENDORS') {
            const vId = parseInt(item.record_id, 10);
            await db.query("UPDATE vendors SET is_active = TRUE WHERE vendor_id = $1", [vId]).catch(() => {});
        } else if (mod === 'ASSETS') {
            const aId = parseInt(item.record_id, 10);
            await db.query("UPDATE assets SET status = 'AVAILABLE' WHERE asset_id = $1", [aId]).catch(() => {});
        } else if (mod === 'DPR') {
            const dprId = parseInt(item.record_id, 10);
            if (data.report_no) {
                await db.query(`
                    INSERT INTO daily_progress_reports (
                        report_id, report_no, site_id, report_date, client_name, contractor_name,
                        po_number, po_value, current_billing_value, billing_progress_pct,
                        today_activities, next_day_activities, show_stoppers, manpower_data, photos
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                    )
                    ON CONFLICT (report_id) DO NOTHING
                `, [
                    dprId, data.report_no, data.site_id, data.report_date, data.client_name, data.contractor_name,
                    data.po_number, data.po_value || 0, data.current_billing_value || 0, data.billing_progress_pct || 0,
                    JSON.stringify(data.today_activities || []), JSON.stringify(data.next_day_activities || []),
                    JSON.stringify(data.show_stoppers || []), JSON.stringify(data.manpower_data || []), JSON.stringify(data.photos || [])
                ]).catch(() => {});
            }
        } else if (mod === 'PROCUREMENT') {
            const pId = parseInt(item.record_id, 10);
            if (data.item_description) {
                await db.query(`
                    INSERT INTO procurement_tracker (
                        tracker_id, site_id, sl_no, item_description, uom, qty,
                        po_status, vendor_name, po_number, location, milestone_stage
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    )
                    ON CONFLICT (tracker_id) DO NOTHING
                `, [
                    pId, data.site_id, data.sl_no || 1, data.item_description, data.uom || 'Mtr', data.qty || 1,
                    data.po_status || 'Pending', data.vendor_name || '', data.po_number || '', data.location || '', data.milestone_stage || 'PO_ISSUED'
                ]).catch(() => {});
            }
        } else if (mod === 'SITES') {
            const sId = parseInt(item.record_id, 10);
            await db.query("UPDATE sites SET is_active = TRUE WHERE site_id = $1", [sId]).catch(() => {});
        } else if (mod === 'SHIFTS') {
            const shId = parseInt(item.record_id, 10);
            await db.query("UPDATE shifts SET is_active = TRUE WHERE shift_id = $1", [shId]).catch(() => {});
        }

        // 2. Mark Recycle Bin record as restored
        await db.query(`
            UPDATE recycle_bin
            SET is_restored = TRUE,
                restored_at = CURRENT_TIMESTAMP,
                restored_by_id = $1,
                restored_by_name = $2
            WHERE bin_id = $3
        `, [userId ? parseInt(userId, 10) : null, userName, binId]);

        // 3. Log to Audit Trail
        await auditService.logAction({
            req,
            userId,
            userName,
            userEmail,
            roleCode,
            action: 'RESTORE',
            module: mod,
            recordId: String(item.record_id),
            recordTitle: item.record_title,
            details: {
                bin_id: item.bin_id,
                restored_by: userName,
                note: `Record restored to active state from Recycle Bin.`
            }
        });

        return {
            success: true,
            message: `"${item.record_title}" restored successfully!`,
            module: mod,
            recordId: item.record_id
        };
    }

    /**
     * Permanently wipe item from Recycle Bin (Super Admin only)
     */
    async permanentlyDelete(binId, { req = null, user = null } = {}) {
        await this.ensureRecycleBinTable();

        const itemRes = await db.query('SELECT * FROM recycle_bin WHERE bin_id = $1', [binId]);
        if (itemRes.rows.length === 0) {
            const err = new Error('Item not found in recycle bin');
            err.status = 404;
            throw err;
        }

        const item = itemRes.rows[0];
        const u = user || req?.user || {};
        const userId = u.userId ?? u.user_id ?? null;
        const userName = u.name || u.fullName || u.email || 'Super Admin';
        const roleCode = u.roleCode || u.role?.roleCode || (typeof u.role === 'string' ? u.role : '') || 'SUPER_ADMIN';

        await db.query('DELETE FROM recycle_bin WHERE bin_id = $1', [binId]);

        // Log permanent destruction
        await auditService.logAction({
            req,
            userId,
            userName,
            userEmail: u.email,
            roleCode,
            action: 'DELETE',
            module: 'RECYCLE_BIN',
            recordId: String(binId),
            recordTitle: `PERMANENT WIPE: ${item.record_title}`,
            details: {
                original_module: item.module,
                original_record_id: item.record_id,
                deleted_by: userName,
                warning: 'Permanently erased from storage'
            }
        });

        return {
            success: true,
            message: `"${item.record_title}" permanently deleted.`
        };
    }
}

module.exports = new RecycleBinService();
