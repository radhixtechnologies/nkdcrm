const db = require('./config/database');

const createBiometricTable = async () => {
    try {
        console.log('Creating biometric_logs table...');

        const query = `
            CREATE TABLE IF NOT EXISTS biometric_logs (
                log_id SERIAL PRIMARY KEY,
                employee_code VARCHAR(50),
                punch_date DATE NOT NULL,
                in_time TIME,
                out_time TIME,
                device_id VARCHAR(50),
                upload_batch_id VARCHAR(100),
                uploaded_by VARCHAR(100),
                is_processed BOOLEAN DEFAULT FALSE,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_code, punch_date)
            );

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_biometric_processed') THEN
                    CREATE INDEX idx_biometric_processed ON biometric_logs(is_processed);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_biometric_batch') THEN
                    CREATE INDEX idx_biometric_batch ON biometric_logs(upload_batch_id);
                END IF;
            END$$;
        `;

        await db.query(query);
        console.log('Table created successfully!');
    } catch (err) {
        console.error('Error creating table:', err);
    } finally {
        process.exit();
    }
};

createBiometricTable();
