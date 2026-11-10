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
        try {
            const res = await db.query(query, [name.trim(), description || null, Boolean(is_monetary)]);
            return res.rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const dup = new Error(`Perk type "${name}" already exists`);
                dup.status = 409;
                throw dup;
            }
            throw err;
        }
    }

    // 2. Get All Perk Types
    async getAllPerkTypes() {
        const res = await db.query('SELECT * FROM perk_types WHERE is_active = TRUE ORDER BY name');
        return res.rows;
    }

    // 3. Assign Perk to Employee
    async assignPerk(data) {
        const { employee_id, perk_type_id, start_date, end_date, remarks } = data;

        const check = await db.query(
            "SELECT 1 FROM employee_perks WHERE employee_id = $1 AND perk_type_id = $2 AND status = 'ACTIVE'",
            [employee_id, perk_type_id]
        );

        if (check.rowCount > 0) {
            const err = new Error('Employee already has this perk active');
            err.status = 409;
            throw err;
        }

        const query = `
            INSERT INTO employee_perks
            (employee_id, perk_type_id, start_date, end_date, remarks, status)
            VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
            RETURNING *, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
        `;
        const res = await db.query(query, [
            employee_id,
            perk_type_id,
            start_date && String(start_date).trim() !== '' ? start_date : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
            end_date && String(end_date).trim() !== '' ? end_date : null,
            remarks || null
        ]);
        return res.rows[0];
    }

    // 4. Get Employee's Active Perks
    async getEmployeePerks(employee_id) {
        const query = `
            SELECT ep.emp_perk_id, ep.employee_id, ep.perk_type_id,
                   TO_CHAR(ep.start_date, 'YYYY-MM-DD') AS start_date,
                   TO_CHAR(ep.end_date, 'YYYY-MM-DD') AS end_date,
                   ep.remarks, ep.status, pt.name, pt.description, pt.is_monetary
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
