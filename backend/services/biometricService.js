const db = require('../config/database');

class BiometricService {
    /**
     * Import raw biometric logs (bulk)
     * @param {Array} logs - [{ employee_code, punch_date, in_time, out_time, device_id }]
     * @param {Object} metadata - { upload_batch_id, uploaded_by }
     */
    async importBiometricLogs(logs, metadata) {
        const { upload_batch_id, uploaded_by } = metadata;
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const [index, log] of logs.entries()) {
            try {
                // Basic Validation
                if (!log.employee_code || !log.punch_date) {
                    throw new Error('Employee Code and Punch Date are required.');
                }

                // Upsert Query: Staging area data
                // We use CONFLICT DO UPDATE so repeated uploads fix/add data for the day
                const query = `
                    INSERT INTO biometric_logs (
                        employee_code, punch_date, in_time, out_time, 
                        device_id, upload_batch_id, uploaded_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (employee_code, punch_date) 
                    DO UPDATE SET
                        in_time = EXCLUDED.in_time,
                        out_time = EXCLUDED.out_time,
                        device_id = EXCLUDED.device_id,
                        upload_batch_id = EXCLUDED.upload_batch_id,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING log_id
                `;

                const values = [
                    log.employee_code,
                    log.punch_date,
                    log.in_time || null,
                    log.out_time || null,
                    log.device_id || null,
                    upload_batch_id,
                    uploaded_by
                ];

                await db.query(query, values);
                results.success++;

            } catch (error) {
                results.failed++;
                results.errors.push({
                    row: index + 2,
                    employee_code: log.employee_code,
                    message: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get pending Biometric Logs (for HR approval screen)
     */
    async getPendingLogs() {
        const query = `
            SELECT b.*, e.first_name, e.last_name, s.shift_name
            FROM biometric_logs b
            LEFT JOIN employees e ON b.employee_code = e.employee_code
            LEFT JOIN shifts s ON e.shift_id = s.shift_id
            WHERE b.is_processed = FALSE
            ORDER BY b.punch_date DESC, b.employee_code ASC
        `;
        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Mark logs as processed (after moving to attendance_daily)
     */
    async markAsProcessed(logIds) {
        if (!logIds || logIds.length === 0) return;

        const query = `
            UPDATE biometric_logs 
            SET is_processed = TRUE, processed_at = CURRENT_TIMESTAMP 
            WHERE log_id = ANY($1)
        `;
        const result = await db.query(query, [logIds]);
        return result.rowCount;
    }
}

module.exports = new BiometricService();
