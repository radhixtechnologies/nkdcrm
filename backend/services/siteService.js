const db = require('../config/database');

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
            nature_of_work
        } = siteData;

        const query = `
            INSERT INTO sites (
                site_code, site_name, address, city, state, pincode, is_active,
                principal_employer_name, principal_employer_address,
                main_contractor_name, main_contractor_address,
                nature_of_work
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const values = [
            site_code, site_name, address, city, state, pincode, is_active ?? true,
            principal_employer_name || null,
            principal_employer_address || null,
            main_contractor_name || null,
            main_contractor_address || null,
            nature_of_work || null
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Update existing site
     */
    async updateSite(id, siteData) {
        const {
            site_code, site_name, address, city, state, pincode, is_active,
            principal_employer_name, principal_employer_address,
            main_contractor_name, main_contractor_address,
            nature_of_work
        } = siteData;

        const query = `
            UPDATE sites 
            SET 
                site_code = $1, site_name = $2, address = $3, city = $4, state = $5, pincode = $6, is_active = $7,
                principal_employer_name = $8, principal_employer_address = $9,
                main_contractor_name = $10, main_contractor_address = $11,
                nature_of_work = $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE site_id = $13
            RETURNING *
        `;
        const values = [
            site_code, site_name, address, city, state, pincode, is_active,
            principal_employer_name || null,
            principal_employer_address || null,
            main_contractor_name || null,
            main_contractor_address || null,
            nature_of_work || null,
            id
        ];
        const result = await db.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('Site not found');
        }
        return result.rows[0];
    }

    /**
     * Delete site
     */
    async deleteSite(id) {
        // Check if employees are assigned
        const checkQuery = `SELECT COUNT(*) FROM employees WHERE site_id = $1`;
        const checkRes = await db.query(checkQuery, [id]);
        if (parseInt(checkRes.rows[0].count) > 0) {
            throw new Error('Cannot delete site with assigned employees');
        }

        const query = `DELETE FROM sites WHERE site_id = $1 RETURNING *`;
        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            throw new Error('Site not found');
        }
        return result.rows[0];
    }
}

module.exports = new SiteService();
