/**
 * Attendance Service
 * Business logic for attendance operations
 * Handles database interactions for attendance data
 */

const db = require('../config/database');

class AttendanceService {
    async createAttendance(attendanceData) {
        const {
            employee_id,
            month,
            year,
            total_days,
            present_days,
            absent_days,
            weekly_off_days,
            leave_days,
            half_days,
            overtime_hours,
            day_wise_attendance,
            uploaded_by,
            remarks
        } = attendanceData;

        const query = `
            INSERT INTO attendance (
                employee_id, month, year, total_days,
                present_days, absent_days, weekly_off_days, leave_days, half_days,
                overtime_hours, day_wise_attendance, uploaded_by, remarks
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *
        `;

        const values = [
            employee_id,
            month,
            year,
            total_days,
            present_days || 0,
            absent_days || 0,
            weekly_off_days || 0,
            leave_days || 0,
            half_days || 0,
            overtime_hours || 0,
            JSON.stringify(day_wise_attendance || {}),
            uploaded_by || null,
            remarks || null
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw new Error(`Attendance for employee ${employee_id} for ${month}/${year} already exists`);
            }
            throw error;
        }
    }

    async attendanceExists(employeeId, month, year) {
        const query = `
            SELECT attendance_id
            FROM attendance
            WHERE employee_id = $1 AND month = $2 AND year = $3
        `;
        const result = await db.query(query, [employeeId, month, year]);
        return result.rows.length > 0;
    }

    async getAttendanceById(attendanceId) {
        const query = 'SELECT * FROM attendance WHERE attendance_id = $1';
        const result = await db.query(query, [attendanceId]);
        return result.rows[0] || null;
    }

    async getAttendanceByEmployee(employeeId, filters = {}) {
        let query = 'SELECT * FROM attendance WHERE employee_id = $1';
        const values = [employeeId];
        let paramCount = 2;

        if (filters.month) {
            query += ` AND month = $${paramCount}`;
            values.push(filters.month);
            paramCount++;
        }

        if (filters.year) {
            query += ` AND year = $${paramCount}`;
            values.push(filters.year);
            paramCount++;
        }

        query += ' ORDER BY year DESC, month DESC';

        const result = await db.query(query, values);
        return result.rows;
    }

    async getAttendanceByPeriod(month, year, employeeId = null) {
        let query = `
            SELECT
                a.*,
                e.employee_code,
                e.first_name,
                e.last_name,
                e.full_name,
                e.designation,
                e.department
            FROM attendance a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE a.month = $1 AND a.year = $2
        `;

        const values = [month, year];

        if (employeeId) {
            query += ` AND a.employee_id = $3`;
            values.push(employeeId);
        }

        query += ' ORDER BY e.employee_code ASC';

        const result = await db.query(query, values);
        return result.rows;
    }

    async updateAttendance(attendanceId, updateData) {
        const allowedFields = [
            'present_days', 'absent_days', 'weekly_off_days', 'leave_days', 'half_days',
            'overtime_hours', 'day_wise_attendance', 'remarks'
        ];

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${paramCount}`);
                values.push(key === 'day_wise_attendance' ? JSON.stringify(value) : value);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(attendanceId);
        const query = `
            UPDATE attendance
            SET ${updates.join(', ')}
            WHERE attendance_id = $${paramCount}
            RETURNING *
        `;

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            throw new Error(`Attendance record with ID ${attendanceId} not found`);
        }

        return result.rows[0];
    }

    async deleteAttendance(attendanceId) {
        const query = 'DELETE FROM attendance WHERE attendance_id = $1 RETURNING *';
        const result = await db.query(query, [attendanceId]);

        if (result.rows.length === 0) {
            throw new Error(`Attendance record with ID ${attendanceId} not found`);
        }

        return result.rows[0];
    }

    async bulkImportAttendance(attendanceData) {
        const results = {
            success: [],
            errors: []
        };

        for (const attData of attendanceData) {
            try {
                const attendance = await this.createAttendance(attData);
                results.success.push({
                    employee_code: attData.employee_code,
                    employee_id: attData.employee_id,
                    month: attData.month,
                    year: attData.year,
                    attendance_id: attendance.attendance_id,
                    message: 'Imported successfully'
                });
            } catch (error) {
                results.errors.push({
                    employee_code: attData.employee_code,
                    employee_id: attData.employee_id,
                    month: attData.month,
                    year: attData.year,
                    row_number: attData._rowNumber,
                    error: error.message
                });
            }
        }

        return results;
    }

    async aggregateDailyLogs(month, year) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Aggregate daily statuses and extra hours above 8h directly from attendance_daily
        const dailyQuery = `
            SELECT
                employee_id,
                UPPER(status) AS status,
                COUNT(*)::int AS count,
                COALESCE(SUM(
                    CASE
                        WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN
                            GREATEST(0, (
                                (CASE WHEN check_out >= check_in
                                    THEN EXTRACT(EPOCH FROM (check_out - check_in))
                                    ELSE EXTRACT(EPOCH FROM (check_out - check_in)) + 86400
                                END) / 3600.0
                            ) - 8.0)
                        ELSE 0
                    END
                ), 0) AS calc_ot_hours
            FROM attendance_daily
            WHERE date >= $1 AND date <= $2
            GROUP BY employee_id, UPPER(status)
        `;

        const dailyResult = await db.query(dailyQuery, [startDate, endDate]);

        const empData = {};
        for (const row of dailyResult.rows) {
            if (!empData[row.employee_id]) {
                empData[row.employee_id] = {
                    present: 0,
                    absent: 0,
                    wo: 0,
                    leave: 0,
                    half: 0,
                    ot: 0
                };
            }

            const count = parseInt(row.count, 10) || 0;
            empData[row.employee_id].ot = Math.round((empData[row.employee_id].ot + parseFloat(row.calc_ot_hours || 0)) * 100) / 100;

            switch (row.status) {
                case 'P': empData[row.employee_id].present += count; break;
                case 'A': empData[row.employee_id].absent += count; break;
                case 'WO': empData[row.employee_id].wo += count; break;
                case 'L': empData[row.employee_id].leave += count; break;
                case 'H':
                case 'HD':
                    empData[row.employee_id].half += count;
                    break;
            }
        }

        for (const [empId, data] of Object.entries(empData)) {
            await db.query(`
                INSERT INTO attendance (
                    employee_id, month, year, total_days,
                    present_days, absent_days, weekly_off_days,
                    leave_days, half_days, overtime_hours
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (employee_id, month, year) DO UPDATE SET
                    total_days = EXCLUDED.total_days,
                    present_days = EXCLUDED.present_days,
                    absent_days = EXCLUDED.absent_days,
                    weekly_off_days = EXCLUDED.weekly_off_days,
                    leave_days = EXCLUDED.leave_days,
                    half_days = EXCLUDED.half_days,
                    overtime_hours = GREATEST(attendance.overtime_hours, EXCLUDED.overtime_hours),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                empId, m, y, lastDay,
                data.present, data.absent, data.wo,
                data.leave, data.half, data.ot
            ]);
        }

        return { message: 'Aggregation complete', count: Object.keys(empData).length };
    }
}

module.exports = new AttendanceService();
