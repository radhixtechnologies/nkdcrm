const db = require('../config/database');

const vendorService = {
    // --- 1. Vendor Master ---
    async getVendors(filters = {}) {
        let query = `
            SELECT v.*,
                   COUNT(a.agreement_id)::int as agreement_count,
                   COUNT(CASE WHEN a.status = 'ACTIVE' THEN 1 END)::int as active_agreements
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
        const code = data.vendor_code || `VND-${Date.now().toString().slice(-5)}`;
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
            data.rating ? parseFloat(data.rating) : 4.0,
            data.bank_name || null,
            data.account_number || null,
            data.ifsc_code || null,
            data.is_active !== undefined ? data.is_active : true
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateVendor(id, data) {
        const query = `
            UPDATE vendors SET
                vendor_name = COALESCE($1, vendor_name),
                category = COALESCE($2, category),
                contact_person = COALESCE($3, contact_person),
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                address = COALESCE($6, address),
                city = COALESCE($7, city),
                state = COALESCE($8, state),
                gstin = COALESCE($9, gstin),
                pan = COALESCE($10, pan),
                pf_code = COALESCE($11, pf_code),
                esic_code = COALESCE($12, esic_code),
                compliance_status = COALESCE($13, compliance_status),
                rating = COALESCE($14, rating),
                bank_name = COALESCE($15, bank_name),
                account_number = COALESCE($16, account_number),
                ifsc_code = COALESCE($17, ifsc_code),
                is_active = COALESCE($18, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE vendor_id = $19
            RETURNING *
        `;
        const params = [
            data.vendor_name, data.category, data.contact_person, data.email, data.phone,
            data.address, data.city, data.state, data.gstin, data.pan,
            data.pf_code, data.esic_code, data.compliance_status,
            data.rating ? parseFloat(data.rating) : null,
            data.bank_name, data.account_number, data.ifsc_code, data.is_active, id
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 2. Vendor Agreements ---
    async getAgreements(vendorId = null) {
        let query = `
            SELECT a.*, v.vendor_name, v.vendor_code, v.category,
                   (a.expiry_date - CURRENT_DATE)::int as days_to_expiry
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
            RETURNING *
        `;
        const params = [
            code,
            data.vendor_id,
            data.title,
            data.start_date,
            data.expiry_date,
            parseFloat(data.contract_value) || 0,
            data.sla_terms || 'Standard vendor SLA terms apply.',
            data.status || 'ACTIVE',
            data.document_url || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 3. Vendor Overview Stats ---
    async getVendorStats() {
        const query = `
            SELECT
                COUNT(*)::int as total_vendors,
                COUNT(CASE WHEN compliance_status = 'COMPLIANT' THEN 1 END)::int as compliant_count,
                COUNT(CASE WHEN compliance_status = 'NON_COMPLIANT' THEN 1 END)::int as non_compliant_count,
                COALESCE(AVG(rating), 4.0)::numeric(3,1) as average_rating
            FROM vendors
        `;
        const agQuery = `
            SELECT
                COUNT(*)::int as total_agreements,
                COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as active_agreements,
                COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END)::int as expired_agreements
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
        await db.query('DELETE FROM vendors WHERE vendor_id = $1', [id]);
        return { success: true, message: 'Vendor deleted successfully' };
    },

    async deleteAgreement(id) {
        await db.query('DELETE FROM vendor_agreements WHERE agreement_id = $1', [id]);
        return { success: true, message: 'Agreement deleted successfully' };
    }
};

module.exports = vendorService;
