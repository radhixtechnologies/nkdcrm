const db = require('../config/database');

const assetService = {
    // --- 1. Assets Master ---
    async getAssets(filters = {}) {
        let query = `
            SELECT a.*, s.site_name,
                   (a.quantity_total - a.quantity_allocated) as in_stock
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
        const code = data.asset_code || `AST-${Date.now().toString().slice(-5)}`;
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
            data.category, // 'UNIFORM', 'HELMET_PPE', 'LAPTOP_IT', 'MOBILE', 'SECURITY_GEAR'
            data.brand_model || null,
            data.serial_number || null,
            parseInt(data.quantity_total) || 1,
            0,
            parseFloat(data.cost) || 0,
            data.condition || 'NEW',
            data.site_id || null,
            data.notes || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateAsset(id, data) {
        const query = `
            UPDATE assets SET
                asset_name = COALESCE($1, asset_name),
                category = COALESCE($2, category),
                brand_model = COALESCE($3, brand_model),
                serial_number = COALESCE($4, serial_number),
                quantity_total = COALESCE($5, quantity_total),
                cost = COALESCE($6, cost),
                condition = COALESCE($7, condition),
                site_id = COALESCE($8, site_id),
                notes = COALESCE($9, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE asset_id = $10
            RETURNING *
        `;
        const params = [
            data.asset_name, data.category, data.brand_model, data.serial_number,
            data.quantity_total ? parseInt(data.quantity_total) : null,
            data.cost ? parseFloat(data.cost) : null,
            data.condition, data.site_id, data.notes, id
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 2. Asset Allocation to Employees ---
    async getAllocations(filters = {}) {
        let query = `
            SELECT al.*,
                   a.asset_name, a.asset_code, a.category,
                   e.full_name as employee_name, e.employee_code, e.designation,
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

    async allocateAsset(data) {
        const qty = parseInt(data.quantity) || 1;

        // Check availability
        const assetRes = await db.query('SELECT * FROM assets WHERE asset_id = $1', [data.asset_id]);
        if (assetRes.rows.length === 0) throw new Error('Asset not found');
        const asset = assetRes.rows[0];

        const available = asset.quantity_total - asset.quantity_allocated;
        if (available < qty) {
            throw new Error(`Insufficient stock. Only ${available} item(s) available.`);
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
            data.site_id || asset.site_id || null,
            data.issued_date || new Date().toISOString().split('T')[0],
            data.return_due_date || null,
            qty,
            data.condition_on_issue || 'GOOD',
            data.remarks || null
        ];
        const res = await db.query(query, params);

        // Increment allocated count in assets
        await db.query(
            'UPDATE assets SET quantity_allocated = quantity_allocated + $1, updated_at = CURRENT_TIMESTAMP WHERE asset_id = $2',
            [qty, data.asset_id]
        );

        return res.rows[0];
    },

    async returnAsset(allocationId, returnData = {}) {
        const alRes = await db.query('SELECT * FROM asset_allocations WHERE allocation_id = $1', [allocationId]);
        if (alRes.rows.length === 0) throw new Error('Allocation record not found');
        const allocation = alRes.rows[0];

        if (allocation.status === 'RETURNED') throw new Error('Asset is already marked as returned');

        const query = `
            UPDATE asset_allocations SET
                status = 'RETURNED',
                returned_date = $1,
                condition_on_return = $2,
                remarks = COALESCE($3, remarks),
                updated_at = CURRENT_TIMESTAMP
            WHERE allocation_id = $4
            RETURNING *
        `;
        const params = [
            returnData.returned_date || new Date().toISOString().split('T')[0],
            returnData.condition_on_return || 'GOOD',
            returnData.remarks || null,
            allocationId
        ];
        const res = await db.query(query, params);

        // Decrement allocated count in assets
        await db.query(
            'UPDATE assets SET quantity_allocated = GREATEST(0, quantity_allocated - $1), updated_at = CURRENT_TIMESTAMP WHERE asset_id = $2',
            [allocation.quantity, allocation.asset_id]
        );

        return res.rows[0];
    },

    // --- 3. Inventory Overview Stats ---
    async getAssetStats() {
        const query = `
            SELECT
                COALESCE(SUM(quantity_total), 0)::int as total_units,
                COALESCE(SUM(quantity_allocated), 0)::int as allocated_units,
                COALESCE(SUM(quantity_total - quantity_allocated), 0)::int as available_stock,
                COUNT(CASE WHEN condition = 'DAMAGED' OR condition = 'NEEDS_REPAIR' THEN 1 END)::int as damaged_count,
                COALESCE(SUM(cost * quantity_total), 0)::numeric as total_inventory_value
            FROM assets
        `;
        const res = await db.query(query);
        return res.rows[0];
    },

    async deleteAsset(id) {
        await db.query('DELETE FROM assets WHERE asset_id = $1', [id]);
        return { success: true, message: 'Asset deleted successfully' };
    }
};

module.exports = assetService;
