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
        if (!origin || allowedOrigins.includes(origin)) {
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

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend API is running'
    });
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
        return res.status(503).json({
            success: false,
            message: 'Auth tables are missing. Run npm run setup:auth in the backend folder.'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing backend process or set a different PORT in .env.`);
        process.exit(1);
    }

    throw error;
});
