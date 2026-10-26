const db = require('../config/database');

class ShiftService {
    /**
     * Create a new shift
     * @param {Object} shiftData 
     */
    async createShift(shiftData) {
        const { shift_name, start_time, end_time, break_minutes, description } = shiftData;

        const query = `
            INSERT INTO shifts (shift_name, start_time, end_time, break_minutes, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const values = [shift_name, start_time, end_time, break_minutes || 60, description];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error(`Shift with name "${shift_name}" already exists`);
            }
            throw error;
        }
    }

    /**
     * Get all active shifts
     */
    async getAllShifts() {
        const query = `SELECT * FROM shifts WHERE is_active = TRUE ORDER BY shift_name ASC`;
        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Get shift by ID
     */
    async getShiftById(shiftId) {
        const query = `SELECT * FROM shifts WHERE shift_id = $1`;
        const result = await db.query(query, [shiftId]);
        return result.rows[0];
    }

    /**
     * Assign shift to an employee
     */
    async assignShiftToEmployee(employeeCode, shiftId) {
        // specific update to minimize side effects
        const query = `
            UPDATE employees 
            SET shift_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE employee_code = $2
            RETURNING employee_id, employee_code, shift_id
        `;

        const result = await db.query(query, [shiftId, employeeCode]);

        if (result.rowCount === 0) {
            throw new Error(`Employee with code "${employeeCode}" not found`);
        }

        return result.rows[0];
    }
    /**
     * Update existing shift
     */
    async updateShift(id, shiftData) {
        const { shift_name, start_time, end_time, break_minutes, description, is_active } = shiftData;
        const query = `
            UPDATE shifts 
            SET shift_name = $1, start_time = $2, end_time = $3, break_minutes = $4, description = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
            WHERE shift_id = $7
            RETURNING *
        `;
        const values = [shift_name, start_time, end_time, break_minutes, description, is_active, id];
        const result = await db.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('Shift not found');
        }
        return result.rows[0];
    }

    /**
     * Delete shift (soft delete or check usage)
     */
    async deleteShift(id) {
        // Check if employees are assigned to this shift
        const checkQuery = `SELECT COUNT(*) FROM employees WHERE shift_id = $1`;
        const checkRes = await db.query(checkQuery, [id]);
        if (parseInt(checkRes.rows[0].count) > 0) {
            throw new Error('Cannot delete shift assigned to employees');
        }

        const query = `DELETE FROM shifts WHERE shift_id = $1 RETURNING *`;
        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            throw new Error('Shift not found');
        }
        return result.rows[0];
    }
}

module.exports = new ShiftService();
