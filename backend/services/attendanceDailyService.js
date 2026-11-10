const db = require('../config/database');

const normalizeTime = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
        const parts = str.split(':');
        return `${String(parts[0]).padStart(2, '0')}:${parts[1]}:${parts[2] || '00'}`;
    }
    return null;
};

class AttendanceDailyService {
    constructor() {
        this.punchTableReadyPromise = null;
    }

    async ensurePunchTable() {
        if (this.punchTableReadyPromise) return this.punchTableReadyPromise;
        this.punchTableReadyPromise = (async () => {
            try {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS attendance_punch_logs (
                        punch_id SERIAL PRIMARY KEY,
                        employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
                        punch_date DATE NOT NULL,
                        check_in TIME NOT NULL,
                        check_out TIME,
                        source VARCHAR(50) DEFAULT 'WEB_PORTAL',
                        latitude NUMERIC(10, 7),
                        longitude NUMERIC(10, 7),
                        location_accuracy NUMERIC(8, 2),
                        punch_address TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_att_punch_emp_date ON attendance_punch_logs(employee_id, punch_date DESC, check_in DESC);
                `);
            } catch (err) {
                this.punchTableReadyPromise = null;
                throw err;
            }
        })();
        return this.punchTableReadyPromise;
    }

    /**
     * Find latest open punch session in attendance_punch_logs (check_out IS NULL)
     */
    async findOpenPunchSession(employeeId, referenceDate = null) {
        await this.ensurePunchTable();
        let query = `
            SELECT punch_id, employee_id, TO_CHAR(punch_date, 'YYYY-MM-DD') AS date,
                   TO_CHAR(check_in, 'HH24:MI:SS') AS check_in,
                   source, latitude, longitude, location_accuracy, punch_address
            FROM attendance_punch_logs
            WHERE employee_id = $1
              AND check_out IS NULL
        `;
        const params = [employeeId];
        if (referenceDate) {
            query += ` AND punch_date >= ($2::date - INTERVAL '1 day') AND punch_date <= $2::date`;
            params.push(referenceDate);
        }
        query += ' ORDER BY punch_date DESC, check_in DESC, punch_id DESC LIMIT 1';
        const res = await db.query(query, params);
        return res.rows[0] || null;
    }

    /**
     * Record a check-in or check-out punch session while keeping attendance_daily in sync
     */
    async recordPunch({
        employee_id,
        punch_type = 'IN',
        date,
        time,
        source,
        latitude,
        longitude,
        location_accuracy,
        punch_address
    }) {
        await this.ensurePunchTable();
        const hasLat = latitude !== undefined && latitude !== null && latitude !== '' && !Number.isNaN(Number(latitude));
        const hasLng = longitude !== undefined && longitude !== null && longitude !== '' && !Number.isNaN(Number(longitude));
        const hasAcc = location_accuracy !== undefined && location_accuracy !== null && location_accuracy !== '' && !Number.isNaN(Number(location_accuracy));
        const finalSource = source || (hasLat ? 'GPS' : 'WEB_PORTAL');
        const latVal = hasLat ? Number(latitude) : null;
        const lngVal = hasLng ? Number(longitude) : null;
        const accVal = hasAcc ? Number(location_accuracy) : null;

        if (punch_type === 'OUT') {
            const openSession = await this.findOpenPunchSession(employee_id, date);

            if (openSession) {
                const updatedRes = await db.query(`
                    UPDATE attendance_punch_logs
                    SET check_out = $1,
                        source = COALESCE(source, $2),
                        latitude = COALESCE(latitude, $3),
                        longitude = COALESCE(longitude, $4),
                        location_accuracy = COALESCE(location_accuracy, $5),
                        punch_address = COALESCE(punch_address, $6),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE punch_id = $7
                    RETURNING *,
                        TO_CHAR(punch_date, 'YYYY-MM-DD') AS date,
                        TO_CHAR(punch_date, 'DD/MM/YYYY') AS date_formatted,
                        TO_CHAR(check_in, 'HH24:MI:SS') AS check_in_fmt,
                        TO_CHAR(check_out, 'HH24:MI:SS') AS check_out_fmt,
                        CASE
                            WHEN check_out >= check_in THEN (check_out - check_in)
                            ELSE ((check_out - check_in) + INTERVAL '24 hours')
                        END AS work_duration,
                        CASE
                            WHEN check_out >= check_in THEN EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER
                            ELSE (EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER + 86400)
                        END AS total_seconds
                `, [time, finalSource, latVal, lngVal, accVal, punch_address || null, openSession.punch_id]);

                await this.upsertAttendance({
                    employee_id,
                    date: openSession.date,
                    status: 'P',
                    source: finalSource,
                    check_out: time,
                    latitude: latVal,
                    longitude: lngVal,
                    location_accuracy: accVal,
                    punch_address: punch_address || null
                });

                return updatedRes.rows[0];
            }

            // Fallback: check if legacy attendance_daily row has open check-in
            const openDaily = await this.findOpenCheckIn(employee_id, date);
            const targetDate = openDaily?.date || date;

            if (openDaily?.check_in) {
                await db.query(`
                    INSERT INTO attendance_punch_logs (
                        employee_id, punch_date, check_in, check_out, source,
                        latitude, longitude, location_accuracy, punch_address
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [employee_id, targetDate, openDaily.check_in, time, finalSource, latVal, lngVal, accVal, punch_address || null]);
            }

            return this.upsertAttendance({
                employee_id,
                date: targetDate,
                status: 'P',
                source: finalSource,
                check_out: time,
                latitude: latVal,
                longitude: lngVal,
                location_accuracy: accVal,
                punch_address: punch_address || null
            });
        }

        // Check-IN: insert a new session row so every single check-in is tracked in full history
        const insertedRes = await db.query(`
            INSERT INTO attendance_punch_logs (
                employee_id, punch_date, check_in, source,
                latitude, longitude, location_accuracy, punch_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *,
                TO_CHAR(punch_date, 'YYYY-MM-DD') AS date,
                TO_CHAR(punch_date, 'DD/MM/YYYY') AS date_formatted,
                TO_CHAR(check_in, 'HH24:MI:SS') AS check_in_fmt,
                NULL::TEXT AS check_out_fmt,
                NULL::INTERVAL AS work_duration,
                NULL::INTEGER AS total_seconds
        `, [employee_id, date, time, finalSource, latVal, lngVal, accVal, punch_address || null]);

        await this.upsertAttendance({
            employee_id,
            date,
            status: 'P',
            source: finalSource,
            check_in: time,
            latitude: latVal,
            longitude: lngVal,
            location_accuracy: accVal,
            punch_address: punch_address || null
        });

        return insertedRes.rows[0];
    }

    /**
     * Get full multi-punch history (combined with any pre-migration attendance_daily rows)
     */
    async getTrackerHistory(employeeId, startDate, endDate) {
        await this.ensurePunchTable();
        const query = `
            SELECT
                p.punch_id,
                NULL::INTEGER AS attendance_id,
                p.employee_id,
                TO_CHAR(p.punch_date, 'YYYY-MM-DD') AS date,
                TO_CHAR(p.punch_date, 'DD/MM/YYYY') AS date_formatted,
                'P'::VARCHAR(10) AS status,
                p.source,
                TO_CHAR(p.check_in, 'HH24:MI:SS') AS check_in,
                TO_CHAR(p.check_out, 'HH24:MI:SS') AS check_out,
                TO_CHAR(p.check_in, 'HH24:MI:SS') AS check_in_fmt,
                TO_CHAR(p.check_out, 'HH24:MI:SS') AS check_out_fmt,
                p.latitude,
                p.longitude,
                p.location_accuracy,
                p.punch_address,
                CASE
                    WHEN p.check_in IS NOT NULL AND p.check_out IS NOT NULL AND p.check_out >= p.check_in
                    THEN (p.check_out - p.check_in)
                    WHEN p.check_in IS NOT NULL AND p.check_out IS NOT NULL AND p.check_out < p.check_in
                    THEN ((p.check_out - p.check_in) + INTERVAL '24 hours')
                    ELSE NULL
                END AS work_duration,
                CASE
                    WHEN p.check_in IS NOT NULL AND p.check_out IS NOT NULL AND p.check_out >= p.check_in
                    THEN EXTRACT(EPOCH FROM (p.check_out - p.check_in))::INTEGER
                    WHEN p.check_in IS NOT NULL AND p.check_out IS NOT NULL AND p.check_out < p.check_in
                    THEN (EXTRACT(EPOCH FROM (p.check_out - p.check_in))::INTEGER + 86400)
                    ELSE NULL
                END AS total_seconds
            FROM attendance_punch_logs p
            WHERE p.employee_id = $1
              AND p.punch_date >= $2
              AND p.punch_date <= $3

            UNION ALL

            SELECT
                NULL::INTEGER AS punch_id,
                a.attendance_id,
                a.employee_id,
                TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
                TO_CHAR(a.date, 'DD/MM/YYYY') AS date_formatted,
                a.status,
                a.source,
                TO_CHAR(a.check_in, 'HH24:MI:SS') AS check_in,
                TO_CHAR(a.check_out, 'HH24:MI:SS') AS check_out,
                TO_CHAR(a.check_in, 'HH24:MI:SS') AS check_in_fmt,
                TO_CHAR(a.check_out, 'HH24:MI:SS') AS check_out_fmt,
                a.latitude,
                a.longitude,
                a.location_accuracy,
                a.punch_address,
                CASE
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out >= a.check_in
                    THEN (a.check_out - a.check_in)
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out < a.check_in
                    THEN ((a.check_out - a.check_in) + INTERVAL '24 hours')
                    ELSE NULL
                END AS work_duration,
                CASE
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out >= a.check_in
                    THEN EXTRACT(EPOCH FROM (a.check_out - a.check_in))::INTEGER
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out < a.check_in
                    THEN (EXTRACT(EPOCH FROM (a.check_out - a.check_in))::INTEGER + 86400)
                    ELSE NULL
                END AS total_seconds
            FROM attendance_daily a
            WHERE a.employee_id = $1
              AND a.date >= $2
              AND a.date <= $3
              AND NOT EXISTS (
                  SELECT 1 FROM attendance_punch_logs p2
                  WHERE p2.employee_id = a.employee_id AND p2.punch_date = a.date
              )

            ORDER BY date DESC, check_in DESC NULLS LAST, punch_id DESC NULLS LAST
        `;
        const res = await db.query(query, [employeeId, startDate, endDate]);
        return res.rows;
    }

    /**
     * Get the latest open check-in row (check_in set, check_out null) for an employee within last 24h/yesterday
     */
    async findOpenCheckIn(employeeId, excludeDate = null) {
        let query = `
            SELECT attendance_id, employee_id, TO_CHAR(date, 'YYYY-MM-DD') AS date,
                   TO_CHAR(check_in, 'HH24:MI:SS') AS check_in
            FROM attendance_daily
            WHERE employee_id = $1
              AND check_in IS NOT NULL
              AND check_out IS NULL
        `;
        const params = [employeeId];
        if (excludeDate) {
            query += ` AND date >= ($2::date - INTERVAL '1 day') AND date <= $2::date`;
            params.push(excludeDate);
        }
        query += ' ORDER BY date DESC LIMIT 1';
        const res = await db.query(query, params);
        return res.rows[0] || null;
    }

    /**
     * Create or update daily attendance
     * @param {Object} data
     */
    async upsertAttendance(data) {
        const {
            employee_id,
            date,
            status,
            source,
            check_in,
            check_out,
            remarks,
            latitude,
            longitude,
            location_accuracy,
            punch_address,
            overwriteTimes = false
        } = data;

        const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
        const hasLng = longitude !== undefined && longitude !== null && longitude !== '';
        const hasAcc = location_accuracy !== undefined && location_accuracy !== null && location_accuracy !== '';

        const checkInExpr = overwriteTimes
            ? 'COALESCE(EXCLUDED.check_in, attendance_daily.check_in)'
            : 'COALESCE(attendance_daily.check_in, EXCLUDED.check_in)';

        const query = `
            INSERT INTO attendance_daily (
                employee_id, date, status, source, check_in, check_out, remarks,
                latitude, longitude, location_accuracy, punch_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (employee_id, date)
            DO UPDATE SET
                status = COALESCE(EXCLUDED.status, attendance_daily.status),
                source = COALESCE(attendance_daily.source, EXCLUDED.source),
                check_in = ${checkInExpr},
                check_out = COALESCE(EXCLUDED.check_out, attendance_daily.check_out),
                remarks = COALESCE(EXCLUDED.remarks, attendance_daily.remarks),
                latitude = COALESCE(attendance_daily.latitude, EXCLUDED.latitude),
                longitude = COALESCE(attendance_daily.longitude, EXCLUDED.longitude),
                location_accuracy = COALESCE(attendance_daily.location_accuracy, EXCLUDED.location_accuracy),
                punch_address = COALESCE(attendance_daily.punch_address, EXCLUDED.punch_address),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *,
            TO_CHAR(date, 'YYYY-MM-DD') AS date,
            TO_CHAR(check_in, 'HH24:MI:SS') AS check_in_fmt,
            TO_CHAR(check_out, 'HH24:MI:SS') AS check_out_fmt,
            CASE
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL AND check_out >= check_in
                THEN (check_out - check_in)
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL AND check_out < check_in
                THEN ((check_out - check_in) + INTERVAL '24 hours')
                ELSE NULL
            END AS work_duration,
            CASE
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL AND check_out >= check_in
                THEN EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER
                WHEN check_in IS NOT NULL AND check_out IS NOT NULL AND check_out < check_in
                THEN (EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER + 86400)
                ELSE NULL
            END AS total_seconds
        `;

        const values = [
            employee_id,
            date,
            status || 'P',
            source || (hasLat ? 'GPS' : 'MANUAL'),
            check_in || null,
            check_out || null,
            remarks || null,
            hasLat ? Number(latitude) : null,
            hasLng ? Number(longitude) : null,
            hasAcc ? Number(location_accuracy) : null,
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

        const d1 = new Date();
        d1.setHours(h1, m1, s1 || 0, 0);
        const d2 = new Date();
        d2.setHours(h2, m2, s2 || 0, 0);

        let diff = d2 - d1;
        if (diff < 0) diff += 24 * 60 * 60 * 1000;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Get attendance for a specific date range with duration
     */
    async getAttendanceByDateRange(startDate, endDate, employeeId = null) {
        await this.ensurePunchTable();
        let query = `
            SELECT
                a.attendance_id,
                a.employee_id,
                TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
                TO_CHAR(a.date, 'DD/MM/YYYY') AS date_formatted,
                a.status,
                a.source,
                TO_CHAR(a.check_in, 'HH24:MI:SS') AS check_in,
                TO_CHAR(a.check_out, 'HH24:MI:SS') AS check_out,
                TO_CHAR(a.check_in, 'HH24:MI:SS') AS check_in_fmt,
                TO_CHAR(a.check_out, 'HH24:MI:SS') AS check_out_fmt,
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
                e.site_id,
                s.site_name,
                (
                    SELECT COUNT(*)::int
                    FROM attendance_punch_logs p
                    WHERE p.employee_id = a.employee_id AND p.punch_date = a.date
                ) AS punch_count,
                CASE
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out >= a.check_in
                    THEN (a.check_out - a.check_in)
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out < a.check_in
                    THEN ((a.check_out - a.check_in) + INTERVAL '24 hours')
                    ELSE NULL
                END AS work_duration,
                CASE
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out >= a.check_in
                    THEN EXTRACT(EPOCH FROM (a.check_out - a.check_in))::INTEGER
                    WHEN a.check_in IS NOT NULL AND a.check_out IS NOT NULL AND a.check_out < a.check_in
                    THEN (EXTRACT(EPOCH FROM (a.check_out - a.check_in))::INTEGER + 86400)
                    ELSE NULL
                END AS total_seconds
            FROM attendance_daily a
            JOIN employees e ON a.employee_id = e.employee_id
            LEFT JOIN sites s ON e.site_id = s.site_id
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

        const employeeCache = {};

        for (const [index, row] of rows.entries()) {
            const rowNum = row._rowNumber || (index + 2);
            const rawCode = String(row.employee_code || '').trim().toUpperCase();
            try {
                if (!rawCode || !row.date) {
                    throw new Error('Employee Code and Date are required');
                }

                let employeeId = employeeCache[rawCode];
                if (!employeeId) {
                    const empRes = await db.query(
                        'SELECT employee_id FROM employees WHERE LOWER(employee_code) = LOWER($1)',
                        [rawCode]
                    );
                    if (empRes.rows.length === 0) {
                        throw new Error(`Employee code "${rawCode}" not found`);
                    }
                    employeeId = empRes.rows[0].employee_id;
                    employeeCache[rawCode] = employeeId;
                }

                let status = String(row.status || 'P').trim().toUpperCase();
                if (status === 'HD') status = 'H';
                const validStatuses = ['P', 'A', 'WO', 'L', 'H'];
                if (!validStatuses.includes(status)) {
                    throw new Error(`Invalid status "${status}". Allowed: P, A, WO, L, H (or HD)`);
                }

                const parsedCheckIn = normalizeTime(row.check_in);
                const parsedCheckOut = normalizeTime(row.check_out);

                await this.upsertAttendance({
                    employee_id: employeeId,
                    date: row.date,
                    status,
                    source: 'EXCEL',
                    check_in: parsedCheckIn,
                    check_out: parsedCheckOut,
                    overwriteTimes: true,
                    remarks: row.remarks || `Imported via Excel (Row ${rowNum})`
                });

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    row: rowNum,
                    employee_code: rawCode,
                    message: error.message
                });
            }
        }
        return {
            total_processed: rows.length,
            successful: results.success,
            success: results.success,
            failed: results.failed,
            errors: results.errors
        };
    }
}

module.exports = new AttendanceDailyService();
