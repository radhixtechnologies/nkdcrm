const db = require('../config/database');

class ShiftService {
    generateShiftCode(shiftName) {
        const prefix = String(shiftName || 'SHF')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 20) || 'SHIFT';
        const suffix = Math.floor(100 + Math.random() * 900);
        return `${prefix}_${suffix}`;
    }

    /**
     * Create a new shift
     * @param {Object} shiftData
     */
    async createShift(shiftData) {
        const {
            shift_code,
            shift_name,
            start_time,
            end_time,
            break_minutes,
            description,
            is_overnight
        } = shiftData;

        if (!shift_name || !start_time || !end_time) {
            const err = new Error('Shift name, start time, and end time are required');
            err.status = 400;
            throw err;
        }

        const code = (shift_code && String(shift_code).trim())
            ? String(shift_code).trim().toUpperCase()
            : this.generateShiftCode(shift_name);

        const parsedBreak = (break_minutes !== undefined && break_minutes !== null && break_minutes !== '')
            ? parseInt(break_minutes, 10)
            : 30;
        const overnight = is_overnight !== undefined
            ? Boolean(is_overnight)
            : String(end_time) < String(start_time);

        const query = `
            INSERT INTO shifts (shift_code, shift_name, start_time, end_time, break_minutes, description, is_overnight)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const values = [
            code,
            shift_name.trim(),
            start_time,
            end_time,
            Number.isNaN(parsedBreak) ? 30 : parsedBreak,
            description || null,
            overnight
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                const err = new Error(`Shift "${shift_name}" or code "${code}" already exists`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    /**
     * Get all shifts (active first, then inactive)
     */
    async getAllShifts() {
        const query = `SELECT * FROM shifts ORDER BY is_active DESC, shift_name ASC`;
        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Get shift by ID
     */
    async getShiftById(shiftId) {
        const query = `SELECT * FROM shifts WHERE shift_id = $1`;
        const result = await db.query(query, [shiftId]);
        return result.rows[0] || null;
    }

    /**
     * Assign shift to an employee
     */
    async assignShiftToEmployee(employeeCode, shiftId) {
        const query = `
            UPDATE employees
            SET shift_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(employee_code) = LOWER($2)
            RETURNING employee_id, employee_code, shift_id
        `;

        const result = await db.query(query, [shiftId || null, employeeCode]);

        if (result.rowCount === 0) {
            const err = new Error(`Employee with code "${employeeCode}" not found`);
            err.status = 404;
            throw err;
        }

        return result.rows[0];
    }

    /**
     * Update existing shift
     */
    async updateShift(id, shiftData) {
        const existing = await this.getShiftById(id);
        if (!existing) {
            const err = new Error('Shift not found');
            err.status = 404;
            throw err;
        }

        const shift_name = shiftData.shift_name ?? existing.shift_name;
        const start_time = shiftData.start_time ?? existing.start_time;
        const end_time = shiftData.end_time ?? existing.end_time;
        const parsedBreak = shiftData.break_minutes !== undefined && shiftData.break_minutes !== ''
            ? parseInt(shiftData.break_minutes, 10)
            : existing.break_minutes;
        const description = shiftData.description !== undefined ? shiftData.description : existing.description;
        const is_active = shiftData.is_active !== undefined ? Boolean(shiftData.is_active) : existing.is_active;
        const is_overnight = shiftData.is_overnight !== undefined
            ? Boolean(shiftData.is_overnight)
            : String(end_time) < String(start_time);

        const query = `
            UPDATE shifts
            SET shift_name = $1,
                start_time = $2,
                end_time = $3,
                break_minutes = $4,
                description = $5,
                is_active = $6,
                is_overnight = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE shift_id = $8
            RETURNING *
        `;
        const values = [shift_name, start_time, end_time, Number.isNaN(parsedBreak) ? 30 : parsedBreak, description, is_active, is_overnight, id];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete shift (or check usage)
     */
    async deleteShift(id) {
        const checkQuery = `SELECT COUNT(*)::int AS cnt FROM employees WHERE shift_id = $1 AND employment_status != 'TERMINATED'`;
        const checkRes = await db.query(checkQuery, [id]);
        if (checkRes.rows[0].cnt > 0) {
            const err = new Error('Cannot delete shift assigned to active employees');
            err.status = 400;
            throw err;
        }

        const query = `DELETE FROM shifts WHERE shift_id = $1 RETURNING *`;
        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            const err = new Error('Shift not found');
            err.status = 404;
            throw err;
        }
        return result.rows[0];
    }
}

module.exports = new ShiftService();
