const db = require('../config/database');

const parseOptionalInt = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
};

class SiteService {
    /**
     * Get all sites
     */
    async getAllSites() {
        const query = `SELECT * FROM sites ORDER BY site_name ASC`;
        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Create new site
     */
    async createSite(siteData) {
        const {
            site_code, site_name, address, city, state, pincode, is_active,
            principal_employer_name, principal_employer_address,
            main_contractor_name, main_contractor_address,
            nature_of_work,
            labour_license_no, labour_license_expiry, max_labour_capacity, license_authority, client_id
        } = siteData;

        const parsedCap = parseOptionalInt(max_labour_capacity);
        const query = `
            INSERT INTO sites (
                site_code, site_name, address, city, state, pincode, is_active,
                principal_employer_name, principal_employer_address,
                main_contractor_name, main_contractor_address,
                nature_of_work,
                labour_license_no, labour_license_expiry, max_labour_capacity, license_authority, client_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;
        const values = [
            String(site_code).trim().toUpperCase(),
            site_name.trim(),
            address || null,
            city || null,
            state || null,
            pincode || null,
            is_active ?? true,
            principal_employer_name || null,
            principal_employer_address || null,
            main_contractor_name || null,
            main_contractor_address || null,
            nature_of_work || null,
            labour_license_no || null,
            labour_license_expiry || null,
            parsedCap !== null ? parsedCap : 50,
            license_authority || null,
            parseOptionalInt(client_id)
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                const err = new Error(`Site code "${site_code}" already exists`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    /**
     * Update existing site
     */
    async updateSite(id, siteData) {
        const existingRes = await db.query('SELECT * FROM sites WHERE site_id = $1', [id]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Site not found');
            err.status = 404;
            throw err;
        }
        const existing = existingRes.rows[0];

        const {
            site_code, site_name, address, city, state, pincode, is_active,
            principal_employer_name, principal_employer_address,
            main_contractor_name, main_contractor_address,
            nature_of_work,
            labour_license_no, labour_license_expiry, max_labour_capacity, license_authority, client_id
        } = siteData;

        const nextCap = max_labour_capacity !== undefined
            ? parseOptionalInt(max_labour_capacity)
            : existing.max_labour_capacity;

        const nextClientId = client_id !== undefined
            ? parseOptionalInt(client_id)
            : existing.client_id;

        const query = `
            UPDATE sites
            SET
                site_code = $1,
                site_name = $2,
                address = $3,
                city = $4,
                state = $5,
                pincode = $6,
                is_active = $7,
                principal_employer_name = $8,
                principal_employer_address = $9,
                main_contractor_name = $10,
                main_contractor_address = $11,
                nature_of_work = $12,
                labour_license_no = $13,
                labour_license_expiry = $14,
                max_labour_capacity = $15,
                license_authority = $16,
                client_id = $17,
                updated_at = CURRENT_TIMESTAMP
            WHERE site_id = $18
            RETURNING *
        `;
        const values = [
            site_code !== undefined ? String(site_code).trim().toUpperCase() : existing.site_code,
            site_name !== undefined ? site_name.trim() : existing.site_name,
            address !== undefined ? (address || null) : existing.address,
            city !== undefined ? (city || null) : existing.city,
            state !== undefined ? (state || null) : existing.state,
            pincode !== undefined ? (pincode || null) : existing.pincode,
            is_active !== undefined ? Boolean(is_active) : existing.is_active,
            principal_employer_name !== undefined ? (principal_employer_name || null) : existing.principal_employer_name,
            principal_employer_address !== undefined ? (principal_employer_address || null) : existing.principal_employer_address,
            main_contractor_name !== undefined ? (main_contractor_name || null) : existing.main_contractor_name,
            main_contractor_address !== undefined ? (main_contractor_address || null) : existing.main_contractor_address,
            nature_of_work !== undefined ? (nature_of_work || null) : existing.nature_of_work,
            labour_license_no !== undefined ? (labour_license_no || null) : existing.labour_license_no,
            labour_license_expiry !== undefined ? (labour_license_expiry || null) : existing.labour_license_expiry,
            nextCap !== null ? nextCap : 50,
            license_authority !== undefined ? (license_authority || null) : existing.license_authority,
            nextClientId,
            id
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                const err = new Error(`Site code "${site_code}" already exists`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    /**
     * Delete site
     */
    async deleteSite(id) {
        const checkQuery = `SELECT COUNT(*)::int AS cnt FROM employees WHERE site_id = $1 AND employment_status != 'TERMINATED'`;
        const checkRes = await db.query(checkQuery, [id]);
        if (checkRes.rows[0].cnt > 0) {
            const err = new Error('Cannot delete site with assigned active employees');
            err.status = 400;
            throw err;
        }

        const query = `DELETE FROM sites WHERE site_id = $1 RETURNING *`;
        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            const err = new Error('Site not found');
            err.status = 404;
            throw err;
        }
        return result.rows[0];
    }
}

module.exports = new SiteService();
