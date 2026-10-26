/**
 * Attendance Service
 * Business logic for attendance operations
 * Handles database interactions for attendance data
 */

const db = require('../config/database');

class AttendanceService {
    /**
     * Create attendance record
     * @param {Object} attendanceData - Attendance data object
     * @returns {Object} Created attendance record
     */
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
            remarks,
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
            JSON.stringify(day_wise_attendance),
            uploaded_by || null,
            remarks || null,
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            // Handle duplicate attendance error
            if (error.code === '23505') {
                throw new Error(`Attendance for employee ${employee_id} for ${month}/${year} already exists`);
            }
            throw error;
        }
    }

    /**
     * Check if attendance exists for employee in a specific month/year
     * @param {number} employeeId - Employee ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {boolean} True if exists
     */
    async attendanceExists(employeeId, month, year) {
        const query = `
      SELECT attendance_id 
      FROM attendance 
      WHERE employee_id = $1 AND month = $2 AND year = $3
    `;
        const result = await db.query(query, [employeeId, month, year]);
        return result.rows.length > 0;
    }

    /**
     * Get attendance by ID
     * @param {number} attendanceId - Attendance ID
     * @returns {Object|null} Attendance object or null
     */
    async getAttendanceById(attendanceId) {
        const query = 'SELECT * FROM attendance WHERE attendance_id = $1';
        const result = await db.query(query, [attendanceId]);
        return result.rows[0] || null;
    }

    /**
     * Get attendance for a specific employee
     * @param {number} employeeId - Employee ID
     * @param {Object} filters - Optional filters (month, year)
     * @returns {Array} Array of attendance records
     */
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

    /**
     * Get all attendance records for a specific month/year
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Array} Array of attendance records with employee details
     */
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

    /**
     * Update attendance record
     * @param {number} attendanceId - Attendance ID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated attendance record
     */
    async updateAttendance(attendanceId, updateData) {
        const allowedFields = [
            'present_days', 'absent_days', 'weekly_off_days', 'leave_days', 'half_days',
            'overtime_hours', 'day_wise_attendance', 'remarks',
        ];

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${paramCount}`);
                // Convert day_wise_attendance to JSON string if it's an object
                values.push(key === 'day_wise_attendance' ? JSON.stringify(value) : value);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

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

    /**
     * Delete attendance record
     * @param {number} attendanceId - Attendance ID
     * @returns {Object} Deleted attendance record
     */
    async deleteAttendance(attendanceId) {
        const query = 'DELETE FROM attendance WHERE attendance_id = $1 RETURNING *';
        const result = await db.query(query, [attendanceId]);

        if (result.rows.length === 0) {
            throw new Error(`Attendance record with ID ${attendanceId} not found`);
        }

        return result.rows[0];
    }

    /**
     * Bulk import attendance records
     * @param {Array} attendanceData - Array of attendance objects
     * @returns {Object} { success: [], errors: [] }
     */
    async bulkImportAttendance(attendanceData) {
        const results = {
            success: [],
            errors: [],
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
                    message: 'Imported successfully',
                });
            } catch (error) {
                results.errors.push({
                    employee_code: attData.employee_code,
                    employee_id: attData.employee_id,
                    month: attData.month,
                    year: attData.year,
                    row_number: attData._rowNumber,
                    error: error.message,
                });
            }
        }

        return results;
    }
    async aggregateDailyLogs(month, year) {
        console.log(`Aggregating daily logs for ${month}/${year}`);

        // 1. Get date range
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        // 2. Aggregate counts from attendance_daily
        const dailyQuery = `
            SELECT 
                employee_id,
                status,
                COUNT(*) as count
            FROM attendance_daily
            WHERE date >= $1 AND date <= $2
            GROUP BY employee_id, status
        `;

        const dailyResult = await db.query(dailyQuery, [startDate, endDate]);

        // 3. Aggregate overtime from attendance_summary
        const otQuery = `
            SELECT 
                employee_id,
                SUM(overtime_hours) as total_ot
            FROM attendance_summary
            WHERE date >= $1 AND date <= $2
            GROUP BY employee_id
        `;

        const otResult = await db.query(otQuery, [startDate, endDate]);

        // 4. Organize data by employee
        const empData = {};

        // Process Daily Counts
        dailyResult.rows.forEach(row => {
            if (!empData[row.employee_id]) empData[row.employee_id] = {
                present: 0,
                absent: 0,
                wo: 0,
                leave: 0,
                half: 0,
                ot: 0
            };

            const count = parseInt(row.count);
            switch (row.status) {
                case 'P': empData[row.employee_id].present += count; break;
                case 'A': empData[row.employee_id].absent += count; break;
                case 'WO': empData[row.employee_id].wo += count; break;
                case 'L': empData[row.employee_id].leave += count; break;
                case 'H': empData[row.employee_id].half += count; break;
            }
        });

        // Process OT
        otResult.rows.forEach(row => {
            if (!empData[row.employee_id]) empData[row.employee_id] = {
                present: 0, absent: 0, wo: 0, leave: 0, half: 0, ot: 0
            };
            empData[row.employee_id].ot = parseFloat(row.total_ot || 0);
        });

        // 5. Update/Insert into attendance table
        for (const [empId, data] of Object.entries(empData)) {
            // Check if record exists
            const checkQuery = `SELECT attendance_id FROM attendance WHERE employee_id = $1 AND month = $2 AND year = $3`;
            const checkRes = await db.query(checkQuery, [empId, month, year]);

            if (checkRes.rows.length > 0) {
                // Update
                await db.query(`
                    UPDATE attendance 
                    SET present_days = $1, absent_days = $2, weekly_off_days = $3, 
                        leave_days = $4, half_days = $5, overtime_hours = $6,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE attendance_id = $7
                `, [
                    data.present, data.absent, data.wo, data.leave, data.half, data.ot,
                    checkRes.rows[0].attendance_id
                ]);
            } else {
                // Insert
                await db.query(`
                    INSERT INTO attendance (
                        employee_id, month, year, total_days,
                        present_days, absent_days, weekly_off_days, 
                        leave_days, half_days, overtime_hours
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    empId, month, year, lastDay,
                    data.present, data.absent, data.wo,
                    data.leave, data.half, data.ot
                ]);
            }
        }

        return { message: 'Aggregation complete', count: Object.keys(empData).length };
    }
}

module.exports = new AttendanceService();
