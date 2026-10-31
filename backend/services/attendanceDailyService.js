const db = require('../config/database');

class AttendanceDailyService {
    /**
     * Create or update daily attendance
     * @param {Object} data 
     */
    async upsertAttendance(data) {
        const { employee_id, date, status, source, check_in, check_out, remarks, latitude, longitude, location_accuracy, punch_address } = data;

        const query = `
            INSERT INTO attendance_daily (
                employee_id, date, status, source, check_in, check_out, remarks,
                latitude, longitude, location_accuracy, punch_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (employee_id, date) 
            DO UPDATE SET 
                status = COALESCE(EXCLUDED.status, attendance_daily.status),
                source = COALESCE(EXCLUDED.source, attendance_daily.source),
                check_in = COALESCE(EXCLUDED.check_in, attendance_daily.check_in),
                check_out = COALESCE(EXCLUDED.check_out, attendance_daily.check_out),
                remarks = COALESCE(EXCLUDED.remarks, attendance_daily.remarks),
                latitude = COALESCE(EXCLUDED.latitude, attendance_daily.latitude),
                longitude = COALESCE(EXCLUDED.longitude, attendance_daily.longitude),
                location_accuracy = COALESCE(EXCLUDED.location_accuracy, attendance_daily.location_accuracy),
                punch_address = COALESCE(EXCLUDED.punch_address, attendance_daily.punch_address),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *, 
            TO_CHAR(check_in, 'HH24:MI:SS') as check_in_fmt,
            TO_CHAR(check_out, 'HH24:MI:SS') as check_out_fmt,
            CASE 
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                THEN (check_out - check_in) 
                ELSE NULL 
            END as work_duration,
            CASE 
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER 
                ELSE NULL 
            END as total_seconds
        `;

        const values = [
            employee_id,
            date,
            status,
            source || (latitude ? 'GPS' : 'MANUAL'),
            check_in || null,
            check_out || null,
            remarks || null,
            latitude || null,
            longitude || null,
            location_accuracy || null,
            punch_address || null
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Helper to calculate duration between two times
     * @param {string} checkIn - "HH:MM:SS"
     * @param {string} checkOut - "HH:MM:SS"
     * @returns {string} Duration in "HH:MM:SS"
     */
    calculateDuration(checkIn, checkOut) {
        if (!checkIn || !checkOut) return null;

        const [h1, m1, s1] = checkIn.split(':').map(Number);
        const [h2, m2, s2] = checkOut.split(':').map(Number);

        const d1 = new Date(); d1.setHours(h1, m1, s1 || 0);
        const d2 = new Date(); d2.setHours(h2, m2, s2 || 0);

        let diff = d2 - d1;
        if (diff < 0) diff += 24 * 60 * 60 * 1000; // Handle overnight shifts

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Get attendance for a specific date range with duration
     */
    async getAttendanceByDateRange(startDate, endDate, employeeId = null) {
        let query = `
            SELECT 
                a.attendance_id,
                a.employee_id,
                TO_CHAR(a.date, 'YYYY-MM-DD') as date,
                TO_CHAR(a.date, 'DD/MM/YYYY') as date_formatted,
                a.status,
                a.source,
                TO_CHAR(a.check_in, 'HH24:MI:SS') as check_in,
                TO_CHAR(a.check_out, 'HH24:MI:SS') as check_out,
                TO_CHAR(a.check_in, 'HH24:MI:SS') as check_in_fmt,
                TO_CHAR(a.check_out, 'HH24:MI:SS') as check_out_fmt,
                a.remarks,
                a.latitude,
                a.longitude,
                a.location_accuracy,
                a.punch_address,
                a.created_at,
                a.updated_at,
                e.employee_code, 
                e.first_name, 
                e.last_name,
                CASE 
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL 
                    THEN (a.check_out - a.check_in) 
                    ELSE NULL 
                END as work_duration,
                CASE 
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (a.check_out - a.check_in))::INTEGER 
                    ELSE NULL 
                END as total_seconds
            FROM attendance_daily a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE a.date >= $1 AND a.date <= $2
        `;
        const params = [startDate, endDate];

        if (employeeId) {
            query += ` AND a.employee_id = $3`;
            params.push(employeeId);
        }

        query += ` ORDER BY a.date DESC, e.employee_code ASC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Bulk Import Attendance from Excel Data (Array of Objects)
     * @param {Array} rows - [{ employee_code, date, status, source, ... }]
     */
    async bulkImport(rows) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Cache employee IDs to avoid repeated DB calls
        const employeeCache = {};

        for (const [index, row] of rows.entries()) {
            try {
                // 1. Resolve Employee ID
                let employeeId = employeeCache[row.employee_code];
                if (!employeeId) {
                    const empRes = await db.query('SELECT employee_id FROM employees WHERE employee_code = $1', [row.employee_code]);
                    if (empRes.rows.length === 0) {
                        throw new Error(`Employee code "${row.employee_code}" not found`);
                    }
                    employeeId = empRes.rows[0].employee_id;
                    employeeCache[row.employee_code] = employeeId;
                }

                // 2. Validate Status
                const validStatuses = ['P', 'A', 'WO', 'L', 'H'];
                const status = (row.status || 'P').toUpperCase();
                if (!validStatuses.includes(status)) {
                    throw new Error(`Invalid status "${status}". Allowed: P, A, WO, L, H`);
                }

                // 3. Upsert
                await this.upsertAttendance({
                    employee_id: employeeId,
                    date: row.date,
                    status: status,
                    source: 'EXCEL',
                    check_in: row.check_in,
                    check_out: row.check_out,
                    remarks: `Imported via Excel (Row ${index + 2})`
                });

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    row: index + 2, // Excel row number (assuming header is row 1)
                    employee_code: row.employee_code,
                    message: error.message
                });
            }
        }
        return results;
    }
}

module.exports = new AttendanceDailyService();
