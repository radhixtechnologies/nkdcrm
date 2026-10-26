const db = require('../config/database');

// Attendance Model (PostgreSQL Implementation)
// Database uses check_in/check_out columns
class Attendance {
    static async findByDate(employeeId, date) {
        // Find existing attendance for user on date
        const query = `
            SELECT * FROM attendance_daily
            WHERE employee_id = $1 AND date = $2
        `;
        const result = await db.query(query, [employeeId, date]);
        return result.rows[0];
    }

    static async create(data) {
        // Create new attendance record
        const { date, employee_id, checkIn, status } = data;

        // Convert JS Date to Postgres Time type
        const time = checkIn.toTimeString().split(' ')[0]; // "HH:MM:SS"

        const query = `
            INSERT INTO attendance_daily (employee_id, date, check_in, status, source)
            VALUES ($1, $2, $3, 'P', 'MANUAL')
            RETURNING *
        `;

        const result = await db.query(query, [employee_id, date, time]);
        return result.rows[0];
    }

    static async updateCheckOut(employeeId, date, checkOut) {
        // Update check-out time
        const time = checkOut.toTimeString().split(' ')[0]; // "HH:MM:SS"

        const query = `
            UPDATE attendance_daily
            SET check_out = $1, updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = $2 AND date = $3
            RETURNING *
        `;

        const result = await db.query(query, [time, employeeId, date]);
        return result.rows[0];
    }

    static async getHistory(employeeId) {
        // Fetch history, newest first
        const query = `
            SELECT 
                date, 
                check_in, 
                check_out,
                CASE 
                    WHEN check_out IS NOT NULL AND check_in IS NOT NULL 
                    THEN (check_out - check_in)
                    ELSE NULL 
                END as duration,
                CASE 
                    WHEN check_out IS NOT NULL AND check_in IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (check_out - check_in))
                    ELSE NULL 
                END as total_seconds
            FROM attendance_daily
            WHERE employee_id = $1
            ORDER BY date DESC
        `;

        const result = await db.query(query, [employeeId]);
        return result.rows;
    }
}

module.exports = Attendance;
