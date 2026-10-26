const { Pool } = require('pg');
const path = require('path');
const { execFileSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: () => String(process.env.DB_PASSWORD ?? ''),
};

const databaseName = process.env.DB_NAME || 'NKD_CRM';

const createDatabaseIfMissing = async () => {
    const adminPool = new Pool({ ...dbConfig, database: 'postgres' });

    try {
        const result = await adminPool.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [databaseName]
        );

        if (result.rowCount === 0) {
            const identifier = databaseName.replace(/"/g, '""');
            await adminPool.query(`CREATE DATABASE "${identifier}"`);
            console.log(`Created database ${databaseName}`);
        } else {
            console.log(`Database ${databaseName} already exists`);
        }
    } finally {
        await adminPool.end();
    }
};

const run = () => {
    createDatabaseIfMissing()
        .then(() => {
            execFileSync(process.execPath, [path.join(__dirname, 'run-migrations.js')], {
                stdio: 'inherit',
                cwd: path.resolve(__dirname, '..'),
            });
            execFileSync(process.execPath, [path.join(__dirname, 'run_auth_migration.js')], {
                stdio: 'inherit',
                cwd: path.resolve(__dirname, '..'),
            });
            execFileSync(process.execPath, [path.join(__dirname, 'create_super_admin.js')], {
                stdio: 'inherit',
                cwd: path.resolve(__dirname, '..'),
            });
        })
        .catch((error) => {
            console.error('Local setup failed:', error.message);
            process.exitCode = 1;
        });
};

run();
