const db = require('../config/database');

const cleanInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : n;
};

const cleanNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const assetService = {
    // --- 1. Assets Master ---
    async getAssets(filters = {}) {
        let query = `
            SELECT a.*, s.site_name,
                   (a.quantity_total - a.quantity_allocated) AS in_stock
            FROM assets a
            LEFT JOIN sites s ON a.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        if (filters.category && filters.category !== 'ALL') {
            params.push(filters.category);
            query += ` AND a.category = $${params.length}`;
        }
        if (filters.condition && filters.condition !== 'ALL') {
            params.push(filters.condition);
            query += ` AND a.condition = $${params.length}`;
        }
        query += ` ORDER BY a.created_at DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createAsset(data) {
        const code = (data.asset_code && String(data.asset_code).trim())
            ? String(data.asset_code).trim().toUpperCase()
            : `AST-${Date.now().toString().slice(-5)}`;
        const qtyTotal = cleanInt(data.quantity_total, 1);
        const query = `
            INSERT INTO assets (
                asset_code, asset_name, category, brand_model, serial_number,
                quantity_total, quantity_allocated, cost, condition, site_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        const params = [
            code,
            data.asset_name,
            data.category,
            data.brand_model || null,
            data.serial_number || null,
            Math.max(0, qtyTotal),
            0,
            cleanNum(data.cost, 0),
            data.condition || 'NEW',
            cleanInt(data.site_id, null),
            data.notes || null
        ];
        try {
            const res = await db.query(query, params);
            return res.rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`Asset code "${code}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    },

    async updateAsset(id, data) {
        const existingRes = await db.query('SELECT * FROM assets WHERE asset_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Asset not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const nextTotal = data.quantity_total !== undefined
            ? cleanInt(data.quantity_total, ex.quantity_total)
            : ex.quantity_total;

        if (nextTotal < ex.quantity_allocated) {
            const err = new Error(`Total quantity (${nextTotal}) cannot be less than currently allocated units (${ex.quantity_allocated})`);
            err.status = 400;
            throw err;
        }

        const query = `
            UPDATE assets SET
                asset_name = $1,
                category = $2,
                brand_model = $3,
                serial_number = $4,
                quantity_total = $5,
                cost = $6,
                condition = $7,
                site_id = $8,
                notes = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE asset_id = $10
            RETURNING *
        `;
        const params = [
            data.asset_name !== undefined ? data.asset_name : ex.asset_name,
            data.category !== undefined ? data.category : ex.category,
            data.brand_model !== undefined ? (data.brand_model || null) : ex.brand_model,
            data.serial_number !== undefined ? (data.serial_number || null) : ex.serial_number,
            nextTotal,
            data.cost !== undefined ? cleanNum(data.cost, ex.cost) : ex.cost,
            data.condition !== undefined ? data.condition : ex.condition,
            data.site_id !== undefined ? cleanInt(data.site_id, null) : ex.site_id,
            data.notes !== undefined ? (data.notes || null) : ex.notes,
            id
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 2. Asset Allocation to Employees ---
    async getAllocations(filters = {}) {
        let query = `
            SELECT al.*,
                   TO_CHAR(al.issued_date, 'YYYY-MM-DD') AS issued_date,
                   TO_CHAR(al.return_due_date, 'YYYY-MM-DD') AS return_due_date,
                   TO_CHAR(al.returned_date, 'YYYY-MM-DD') AS returned_date,
                   a.asset_name, a.asset_code, a.category, a.brand_model, a.serial_number, a.notes AS asset_notes,
                   e.full_name AS employee_name, e.employee_code, e.designation, e.mobile AS phone, e.email, e.department,
                   s.site_name
            FROM asset_allocations al
            JOIN assets a ON al.asset_id = a.asset_id
            JOIN employees e ON al.employee_id = e.employee_id
            LEFT JOIN sites s ON al.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];
        if (filters.employee_id) {
            params.push(filters.employee_id);
            query += ` AND al.employee_id = $${params.length}`;
        }
        if (filters.status && filters.status !== 'ALL') {
            params.push(filters.status);
            query += ` AND al.status = $${params.length}`;
        }
        query += ` ORDER BY al.created_at DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async getAllocationById(id) {
        const query = `
            SELECT al.*,
                   TO_CHAR(al.issued_date, 'YYYY-MM-DD') AS issued_date,
                   TO_CHAR(al.return_due_date, 'YYYY-MM-DD') AS return_due_date,
                   TO_CHAR(al.returned_date, 'YYYY-MM-DD') AS returned_date,
                   a.asset_name, a.asset_code, a.category, a.brand_model, a.serial_number, a.notes AS asset_notes,
                   e.full_name AS employee_name, e.employee_code, e.designation, e.mobile AS phone, e.email, e.department,
                   s.site_name
            FROM asset_allocations al
            JOIN assets a ON al.asset_id = a.asset_id
            JOIN employees e ON al.employee_id = e.employee_id
            LEFT JOIN sites s ON al.site_id = s.site_id
            WHERE al.allocation_id = $1
        `;
        const res = await db.query(query, [id]);
        return res.rows[0] || null;
    },

    async getEmployeeAllocations(employeeId) {
        const query = `
            SELECT al.*,
                   TO_CHAR(al.issued_date, 'YYYY-MM-DD') AS issued_date,
                   TO_CHAR(al.return_due_date, 'YYYY-MM-DD') AS return_due_date,
                   TO_CHAR(al.returned_date, 'YYYY-MM-DD') AS returned_date,
                   a.asset_name, a.asset_code, a.category, a.brand_model, a.serial_number, a.notes AS asset_notes,
                   e.full_name AS employee_name, e.employee_code, e.designation, e.mobile AS phone, e.email, e.department,
                   s.site_name
            FROM asset_allocations al
            JOIN assets a ON al.asset_id = a.asset_id
            JOIN employees e ON al.employee_id = e.employee_id
            LEFT JOIN sites s ON al.site_id = s.site_id
            WHERE al.employee_id = $1
            ORDER BY al.created_at DESC
        `;
        const res = await db.query(query, [employeeId]);
        return res.rows;
    },

    async allocateAsset(data) {
        const qty = cleanInt(data.quantity, 1);
        if (!qty || qty <= 0) {
            const err = new Error('Allocation quantity must be greater than zero');
            err.status = 400;
            throw err;
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const assetRes = await client.query('SELECT * FROM assets WHERE asset_id = $1 FOR UPDATE', [data.asset_id]);
            if (assetRes.rows.length === 0) {
                const err = new Error('Asset not found');
                err.status = 404;
                throw err;
            }
            const asset = assetRes.rows[0];

            const available = asset.quantity_total - asset.quantity_allocated;
            if (available < qty) {
                const err = new Error(`Insufficient stock. Only ${available} item(s) available.`);
                err.status = 400;
                throw err;
            }

            const query = `
                INSERT INTO asset_allocations (
                    asset_id, employee_id, site_id, issued_date, return_due_date,
                    quantity, status, condition_on_issue, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, 'ISSUED', $7, $8)
                RETURNING *
            `;
            const params = [
                data.asset_id,
                data.employee_id,
                cleanInt(data.site_id, asset.site_id),
                data.issued_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                data.return_due_date && String(data.return_due_date).trim() !== '' ? data.return_due_date : null,
                qty,
                data.condition_on_issue || 'GOOD',
                data.remarks || null
            ];
            const res = await client.query(query, params);

            await client.query(
                'UPDATE assets SET quantity_allocated = quantity_allocated + $1, updated_at = CURRENT_TIMESTAMP WHERE asset_id = $2',
                [qty, data.asset_id]
            );

            await client.query('COMMIT');
            return res.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async returnAsset(allocationId, returnData = {}) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const alRes = await client.query('SELECT * FROM asset_allocations WHERE allocation_id = $1 FOR UPDATE', [allocationId]);
            if (alRes.rows.length === 0) {
                const err = new Error('Allocation record not found');
                err.status = 404;
                throw err;
            }
            const allocation = alRes.rows[0];

            if (allocation.status !== 'ISSUED') {
                const err = new Error(`Allocation is already marked as ${allocation.status}`);
                err.status = 400;
                throw err;
            }

            const cond = String(returnData.condition_on_return || 'GOOD').toUpperCase();
            const isLost = cond === 'LOST' || String(returnData.status || '').toUpperCase() === 'LOST';
            const nextStatus = isLost ? 'LOST' : (cond === 'DAMAGED' ? 'DAMAGED' : 'RETURNED');

            const res = await client.query(`
                UPDATE asset_allocations SET
                    status = $1,
                    returned_date = $2,
                    condition_on_return = $3,
                    remarks = COALESCE($4, remarks),
                    updated_at = CURRENT_TIMESTAMP
                WHERE allocation_id = $5
                RETURNING *
            `, [
                nextStatus,
                returnData.returned_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
                cond,
                returnData.remarks || null,
                allocationId
            ]);

            if (isLost) {
                // Lost items are no longer allocated AND removed from usable total stock
                await client.query(`
                    UPDATE assets SET
                        quantity_allocated = GREATEST(0, quantity_allocated - $1),
                        quantity_total = GREATEST(0, quantity_total - $1),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE asset_id = $2
                `, [allocation.quantity, allocation.asset_id]);
            } else {
                await client.query(`
                    UPDATE assets SET
                        quantity_allocated = GREATEST(0, quantity_allocated - $1),
                        condition = CASE WHEN $2 = 'DAMAGED' THEN 'DAMAGED' ELSE condition END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE asset_id = $3
                `, [allocation.quantity, cond, allocation.asset_id]);
            }

            await client.query('COMMIT');
            return res.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    // --- 3. Inventory Overview Stats ---
    async getAssetStats() {
        const query = `
            SELECT
                COALESCE(SUM(quantity_total), 0)::int AS total_units,
                COALESCE(SUM(quantity_allocated), 0)::int AS allocated_units,
                COALESCE(SUM(quantity_total - quantity_allocated), 0)::int AS available_stock,
                COUNT(CASE WHEN condition IN ('DAMAGED', 'NEEDS_REPAIR') THEN 1 END)::int AS damaged_count,
                COALESCE(SUM(cost * quantity_total), 0)::numeric AS total_inventory_value
            FROM assets
        `;
        const res = await db.query(query);
        return res.rows[0];
    },

    async deleteAsset(id, user = null, req = null) {
        const existingRes = await db.query('SELECT * FROM assets WHERE asset_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Asset not found');
            err.status = 404;
            throw err;
        }
        const asset = existingRes.rows[0];
        if (asset.quantity_allocated > 0) {
            const err = new Error('Cannot delete asset that has units currently issued to employees');
            err.status = 400;
            throw err;
        }

        // Archive into Recycle Bin & Audit Trail
        const recycleBinService = require('./recycleBinService');
        await recycleBinService.moveToBin({
            module: 'ASSETS',
            recordId: id,
            recordTitle: `Asset: ${asset.asset_name} (${asset.asset_code || id})`,
            recordData: asset,
            user,
            req
        }).catch((err) => console.error('Asset recycle bin archive error:', err));

        await db.query('DELETE FROM assets WHERE asset_id = $1', [id]);
        return { success: true, message: 'Asset moved to Recycle Bin successfully' };
    }
};

module.exports = assetService;
