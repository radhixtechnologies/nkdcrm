const db = require('../config/database');

class OvertimeService {
    /**
     * Calculate overtime for a specific employee on a specific date
     */
    async calculateDailyOvertime(employeeId, dateStr) {
        // 1. Fetch Daily Log & Employee Shift
        const query = `
            SELECT 
                a.check_in, a.check_out, a.status, a.break_taken_minutes as actual_break,
                e.shift_id,
                s.start_time, s.end_time, s.break_minutes as shift_break
            FROM attendance_daily a
            JOIN employees e ON a.employee_id = e.employee_id
            LEFT JOIN shifts s ON e.shift_id = s.shift_id
            WHERE a.employee_id = $1 AND a.date = $2
        `;

        const res = await db.query(query, [employeeId, dateStr]);
        if (res.rows.length === 0) return null; // No attendance record

        const log = res.rows[0];

        // Skip if no shift assigned or absent
        // We still save a summary to track "0 hours" for payroll visibility
        if (!log.shift_id || ['A', 'WO', 'L', 'H'].includes(log.status)) {
            return await this.saveSummary({
                employee_id: employeeId, date: dateStr, shift_id: log.shift_id,
                expected_hours: 0, worked_hours: 0, overtime_hours: 0,
                in_time: null, out_time: null, break_taken: 0,
                remarks: `Status: ${log.status}`
            });
        }

        // 2. Validate Times
        if (!log.check_in || !log.check_out) {
            return await this.saveSummary({
                employee_id: employeeId, date: dateStr, shift_id: log.shift_id,
                expected_hours: 0, worked_hours: 0, overtime_hours: 0,
                in_time: log.check_in, out_time: log.check_out, break_taken: 0,
                remarks: 'Missing In/Out Times'
            });
        }

        // 3. Calculate Hours
        // Parse dates (Assumes dateStr is 'YYYY-MM-DD')
        const inDate = new Date(`${dateStr}T${log.check_in}`);
        let outDate = new Date(`${dateStr}T${log.check_out}`);

        // Handle overnight shift (if Out < In)
        if (outDate < inDate) {
            outDate.setDate(outDate.getDate() + 1);
        }

        // Shift Duration (Expected)
        const shiftStart = new Date(`${dateStr}T${log.start_time}`);
        let shiftEnd = new Date(`${dateStr}T${log.end_time}`);

        if (shiftEnd < shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
        }

        // Break Logic
        // Use actual break if available, else default shift break
        const breakMinutes = log.actual_break || log.shift_break || 0;

        // Calculate Expected
        const expectedMillis = (shiftEnd - shiftStart) - (log.shift_break * 60000);
        const expectedHours = Math.max(0, expectedMillis / (1000 * 60 * 60));

        // Calculate Worked
        const workedMillis = (outDate - inDate) - (breakMinutes * 60000);
        const workedHours = Math.max(0, workedMillis / (1000 * 60 * 60));

        // Calculate Overtime
        // Only if worked > expected
        const overtimeHours = Math.max(0, workedHours - expectedHours);

        return await this.saveSummary({
            employee_id: employeeId, date: dateStr, shift_id: log.shift_id,
            expected_hours: expectedHours.toFixed(2),
            worked_hours: workedHours.toFixed(2),
            overtime_hours: overtimeHours.toFixed(2),
            in_time: log.check_in, out_time: log.check_out,
            break_taken: breakMinutes,
            remarks: 'Calculated'
        });
    }

    async saveSummary(data) {
        const query = `
            INSERT INTO attendance_summary (
                employee_id, date, shift_id, expected_hours, 
                worked_hours, overtime_hours, in_time, out_time, 
                break_taken_minutes, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (employee_id, date)
            DO UPDATE SET
                shift_id = EXCLUDED.shift_id,
                expected_hours = EXCLUDED.expected_hours,
                worked_hours = EXCLUDED.worked_hours,
                overtime_hours = EXCLUDED.overtime_hours,
                in_time = EXCLUDED.in_time,
                out_time = EXCLUDED.out_time,
                break_taken_minutes = EXCLUDED.break_taken_minutes,
                remarks = EXCLUDED.remarks,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const values = [
            data.employee_id, data.date, data.shift_id, data.expected_hours,
            data.worked_hours, data.overtime_hours, data.in_time, data.out_time,
            data.break_taken, data.remarks
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (err) {
            console.error('Error saving summary:', err);
            throw err;
        }
    }

    /**
     * Process range for all employees
     */
    async processOvertimeForRange(startDate, endDate) {
        // Fetch dates as formatted strings to avoid JS timezone issues
        const query = `
            SELECT employee_id, TO_CHAR(date, 'YYYY-MM-DD') as date_str 
            FROM attendance_daily 
            WHERE date BETWEEN $1 AND $2
        `;
        const res = await db.query(query, [startDate, endDate]);

        let processed = 0;

        for (const row of res.rows) {
            await this.calculateDailyOvertime(row.employee_id, row.date_str);
            processed++;
        }

        return { processed, saved: processed };
    }

    /**
     * Get Report (Monthly)
     */
    async getOvertimeReport(month, year) {
        const query = `
            SELECT 
                e.employee_code, e.first_name, e.last_name,
                COUNT(s.date) as days_present,
                SUM(s.expected_hours) as total_expected,
                SUM(s.worked_hours) as total_worked,
                SUM(s.overtime_hours) as total_overtime
            FROM attendance_summary s
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE EXTRACT(MONTH FROM s.date) = $1 AND EXTRACT(YEAR FROM s.date) = $2
            GROUP BY e.employee_code, e.first_name, e.last_name
            ORDER BY total_overtime DESC
        `;
        const result = await db.query(query, [month, year]);
        return result.rows;
    }
}

module.exports = new OvertimeService();
