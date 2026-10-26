const db = require('../config/database');

class PerkService {
    // 1. Create Perk Type (Master)
    async createPerkType(data) {
        const { name, description, is_monetary } = data;
        const query = `
            INSERT INTO perk_types (name, description, is_monetary)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const res = await db.query(query, [name, description, is_monetary || false]);
        return res.rows[0];
    }

    // 2. Get All Perk Types
    async getAllPerkTypes() {
        const res = await db.query('SELECT * FROM perk_types WHERE is_active = TRUE ORDER BY name');
        return res.rows;
    }

    // 3. Assign Perk to Employee
    async assignPerk(data) {
        const { employee_id, perk_type_id, start_date, end_date, remarks } = data;

        // Optional: Check if already assigned active perk of same type?
        // Query to prevent duplicate active assignment of same perk type
        const check = await db.query(
            "SELECT 1 FROM employee_perks WHERE employee_id = $1 AND perk_type_id = $2 AND status = 'ACTIVE'",
            [employee_id, perk_type_id]
        );

        if (check.rowCount > 0) {
            throw new Error('Employee already has this perk active');
        }

        const query = `
            INSERT INTO employee_perks 
            (employee_id, perk_type_id, start_date, end_date, remarks, status)
            VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
            RETURNING *
        `;
        const res = await db.query(query, [
            employee_id,
            perk_type_id,
            start_date || new Date(),
            end_date || null,
            remarks
        ]);
        return res.rows[0];
    }

    // 4. Get Employee's Active Perks
    async getEmployeePerks(employee_id) {
        const query = `
            SELECT ep.emp_perk_id, ep.employee_id, ep.perk_type_id, ep.start_date, ep.end_date, ep.remarks, ep.status, pt.name, pt.description, pt.is_monetary
            FROM employee_perks ep
            JOIN perk_types pt ON ep.perk_type_id = pt.perk_type_id
            WHERE ep.employee_id = $1 AND ep.status = 'ACTIVE'
            ORDER BY ep.start_date DESC
        `;
        const res = await db.query(query, [employee_id]);
        return res.rows;
    }
}

module.exports = new PerkService();
