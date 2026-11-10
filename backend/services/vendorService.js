const db = require('../config/database');

const cleanNum = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const vendorService = {
    // --- 1. Vendor Master ---
    async getVendors(filters = {}) {
        let query = `
            SELECT v.*,
                   COUNT(a.agreement_id)::int AS agreement_count,
                   COUNT(CASE WHEN a.status = 'ACTIVE' THEN 1 END)::int AS active_agreements
            FROM vendors v
            LEFT JOIN vendor_agreements a ON a.vendor_id = v.vendor_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.category && filters.category !== 'ALL') {
            params.push(filters.category);
            query += ` AND v.category = $${params.length}`;
        }
        if (filters.compliance_status && filters.compliance_status !== 'ALL') {
            params.push(filters.compliance_status);
            query += ` AND v.compliance_status = $${params.length}`;
        }

        query += ` GROUP BY v.vendor_id ORDER BY v.vendor_name ASC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createVendor(data) {
        const code = (data.vendor_code && String(data.vendor_code).trim())
            ? String(data.vendor_code).trim().toUpperCase()
            : `VND-${Date.now().toString().slice(-5)}`;
        const query = `
            INSERT INTO vendors (
                vendor_code, vendor_name, category, contact_person, email, phone,
                address, city, state, gstin, pan, pf_code, esic_code,
                compliance_status, rating, bank_name, account_number, ifsc_code, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `;
        const params = [
            code,
            data.vendor_name,
            data.category || 'MANPOWER',
            data.contact_person || null,
            data.email || null,
            data.phone || null,
            data.address || null,
            data.city || null,
            data.state || null,
            data.gstin || null,
            data.pan || null,
            data.pf_code || null,
            data.esic_code || null,
            data.compliance_status || 'COMPLIANT',
            cleanNum(data.rating, 4.0),
            data.bank_name || null,
            data.account_number || null,
            data.ifsc_code || null,
            data.is_active !== undefined ? Boolean(data.is_active) : true
        ];
        try {
            const res = await db.query(query, params);
            return res.rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`Vendor code "${code}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    },

    async updateVendor(id, data) {
        const existingRes = await db.query('SELECT * FROM vendors WHERE vendor_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Vendor not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const query = `
            UPDATE vendors SET
                vendor_name = $1,
                category = $2,
                contact_person = $3,
                email = $4,
                phone = $5,
                address = $6,
                city = $7,
                state = $8,
                gstin = $9,
                pan = $10,
                pf_code = $11,
                esic_code = $12,
                compliance_status = $13,
                rating = $14,
                bank_name = $15,
                account_number = $16,
                ifsc_code = $17,
                is_active = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE vendor_id = $19
            RETURNING *
        `;
        const params = [
            data.vendor_name !== undefined ? data.vendor_name : ex.vendor_name,
            data.category !== undefined ? data.category : ex.category,
            data.contact_person !== undefined ? (data.contact_person || null) : ex.contact_person,
            data.email !== undefined ? (data.email || null) : ex.email,
            data.phone !== undefined ? (data.phone || null) : ex.phone,
            data.address !== undefined ? (data.address || null) : ex.address,
            data.city !== undefined ? (data.city || null) : ex.city,
            data.state !== undefined ? (data.state || null) : ex.state,
            data.gstin !== undefined ? (data.gstin || null) : ex.gstin,
            data.pan !== undefined ? (data.pan || null) : ex.pan,
            data.pf_code !== undefined ? (data.pf_code || null) : ex.pf_code,
            data.esic_code !== undefined ? (data.esic_code || null) : ex.esic_code,
            data.compliance_status !== undefined ? data.compliance_status : ex.compliance_status,
            data.rating !== undefined ? cleanNum(data.rating, ex.rating) : ex.rating,
            data.bank_name !== undefined ? (data.bank_name || null) : ex.bank_name,
            data.account_number !== undefined ? (data.account_number || null) : ex.account_number,
            data.ifsc_code !== undefined ? (data.ifsc_code || null) : ex.ifsc_code,
            data.is_active !== undefined ? Boolean(data.is_active) : ex.is_active,
            id
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 2. Vendor Agreements ---
    async getAgreements(vendorId = null) {
        let query = `
            SELECT a.*,
                   TO_CHAR(a.start_date, 'YYYY-MM-DD') AS start_date,
                   TO_CHAR(a.expiry_date, 'YYYY-MM-DD') AS expiry_date,
                   v.vendor_name, v.vendor_code, v.category,
                   (a.expiry_date - CURRENT_DATE)::int AS days_to_expiry
            FROM vendor_agreements a
            JOIN vendors v ON a.vendor_id = v.vendor_id
            WHERE 1=1
        `;
        const params = [];
        if (vendorId) {
            params.push(vendorId);
            query += ` AND a.vendor_id = $1`;
        }
        query += ` ORDER BY a.expiry_date ASC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createAgreement(data) {
        const code = `AGR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const query = `
            INSERT INTO vendor_agreements (
                agreement_code, vendor_id, title, start_date, expiry_date,
                contract_value, sla_terms, status, document_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date
        `;
        const params = [
            code,
            data.vendor_id,
            data.title,
            data.start_date,
            data.expiry_date,
            cleanNum(data.contract_value, 0),
            data.sla_terms || 'Standard vendor SLA terms apply.',
            data.status || 'ACTIVE',
            data.document_url || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateAgreement(id, data) {
        const existingRes = await db.query('SELECT * FROM vendor_agreements WHERE agreement_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Vendor agreement not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];
        const res = await db.query(`
            UPDATE vendor_agreements SET
                title = $1,
                start_date = $2,
                expiry_date = $3,
                contract_value = $4,
                sla_terms = $5,
                status = $6,
                document_url = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE agreement_id = $8
            RETURNING *, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date
        `, [
            data.title !== undefined ? data.title : ex.title,
            data.start_date !== undefined ? data.start_date : ex.start_date,
            data.expiry_date !== undefined ? data.expiry_date : ex.expiry_date,
            data.contract_value !== undefined ? cleanNum(data.contract_value, ex.contract_value) : ex.contract_value,
            data.sla_terms !== undefined ? (data.sla_terms || null) : ex.sla_terms,
            data.status !== undefined ? data.status : ex.status,
            data.document_url !== undefined ? (data.document_url || null) : ex.document_url,
            id
        ]);
        return res.rows[0];
    },

    // --- 3. Vendor Overview Stats ---
    async getVendorStats() {
        const query = `
            SELECT
                COUNT(*)::int AS total_vendors,
                COUNT(CASE WHEN compliance_status = 'COMPLIANT' THEN 1 END)::int AS compliant_count,
                COUNT(CASE WHEN compliance_status = 'NON_COMPLIANT' THEN 1 END)::int AS non_compliant_count,
                COALESCE(AVG(rating), 4.0)::numeric(3,1) AS average_rating
            FROM vendors
        `;
        const agQuery = `
            SELECT
                COUNT(*)::int AS total_agreements,
                COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_agreements,
                COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END)::int AS expired_agreements
            FROM vendor_agreements
        `;
        const [vRes, aRes] = await Promise.all([
            db.query(query),
            db.query(agQuery)
        ]);
        return {
            ...vRes.rows[0],
            ...aRes.rows[0]
        };
    },

    async deleteVendor(id) {
        const res = await db.query('DELETE FROM vendors WHERE vendor_id = $1 RETURNING vendor_id', [id]);
        if (res.rows.length === 0) {
            const err = new Error('Vendor not found');
            err.status = 404;
            throw err;
        }
        return { success: true, message: 'Vendor deleted successfully' };
    },

    async deleteAgreement(id) {
        const res = await db.query('DELETE FROM vendor_agreements WHERE agreement_id = $1 RETURNING agreement_id', [id]);
        if (res.rows.length === 0) {
            const err = new Error('Agreement not found');
            err.status = 404;
            throw err;
        }
        return { success: true, message: 'Agreement deleted successfully' };
    }
};

module.exports = vendorService;
