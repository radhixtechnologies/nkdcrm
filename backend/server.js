const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const crmRoutes = require('./routes/crm');

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) {
            callback(null, true);
            return;
        }

        const isAllowed = 
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app') ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('192.168.') ||
            origin.includes('10.') ||
            origin.includes('172.');

        if (isAllowed) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'NKD CRM API Server is live and operational',
        status: 'online',
        healthCheck: '/api/health'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend API is running'
    });
});

app.get('/api/download/apk', (req, res) => {
    const apkPath = path.resolve(__dirname, '..', 'NKD-CRM.apk');
    if (require('fs').existsSync(apkPath)) {
        res.download(apkPath, 'NKD-CRM.apk');
    } else {
        res.status(404).json({ success: false, message: 'APK not found' });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', crmRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);

    const databaseConnectionFailed = err.code === 'ECONNREFUSED'
        || err.cause?.code === 'ECONNREFUSED'
        || err.errors?.some?.(error => error.code === 'ECONNREFUSED');

    if (databaseConnectionFailed) {
        return res.status(503).json({
            success: false,
            message: 'PostgreSQL database is not running on localhost:5432. Start PostgreSQL and check backend/.env.'
        });
    }

    if (err.code === '28P01') {
        return res.status(503).json({
            success: false,
            message: 'PostgreSQL password is incorrect. Update DB_PASSWORD in backend/.env.'
        });
    }

    if (err.code === '3D000') {
        return res.status(503).json({
            success: false,
            message: 'PostgreSQL database does not exist. Create DB_NAME from backend/.env, then run npm run setup:auth.'
        });
    }

    if (err.code === '42P01') {
        const missingRelation = err.message ? err.message.replace('relation ', '').replace(' does not exist', '') : 'table';
        try {
            const { initializeDatabase } = require('./services/initDb');
            initializeDatabase().catch(() => {});
        } catch (_) {}

        return res.status(503).json({
            success: false,
            message: `Database table missing: ${missingRelation}. Initializing tables, please refresh.`
        });
    }

    if (err.code === 'ENOTFOUND' || err.message?.includes('getaddrinfo') || err.message?.includes('password authentication failed')) {
        return res.status(503).json({
            success: false,
            message: 'Database connection failed. Please check your Render DATABASE_URL or database settings.'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port} and network http://0.0.0.0:${port}`);

    // Auto-initialize DB on startup for both local and cloud databases
    const { initializeDatabase } = require('./services/initDb');
    initializeDatabase().then(() => {
        console.log('✅ Database schema verified and initialized.');
    }).catch(err => {
        console.warn('Database initialization note:', err.message);
    });
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing backend process or set a different PORT in .env.`);
        process.exit(1);
    }

    throw error;
});
