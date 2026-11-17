const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const upload = require('./config/multer');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const crmRoutes = require('./routes/crm');

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const isOriginAllowed = (origin, reqHost) => {
    if (!origin) return true;
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') {
        return true;
    }

    try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        if (reqHost && parsed.host.toLowerCase() === String(reqHost).toLowerCase()) return true;
        if (host === 'nkdpowersolutions.in' || host.endsWith('.nkdpowersolutions.in')) return true;
        if (host === 'localhost' || host === '127.0.0.1') return true;
        if (host.endsWith('.vercel.app')) return true;
        if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
    } catch (_) {
        return false;
    }

    return false;
};

app.use(cors((req, callback) => {
    const origin = req.header('Origin');
    const reqHost = req.header('X-Forwarded-Host') || req.header('Host');
    if (isOriginAllowed(origin, reqHost)) {
        callback(null, { origin: true, credentials: true });
        return;
    }
    const err = new Error(`CORS blocked origin: ${origin}`);
    err.status = 403;
    callback(err);
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded files from active uploadDir (and fallback project uploads dir)
app.use('/uploads', express.static(upload.uploadDir));
const repoUploadsDir = path.resolve(__dirname, '..', 'uploads');
if (path.resolve(upload.uploadDir) !== repoUploadsDir && fs.existsSync(repoUploadsDir)) {
    app.use('/uploads', express.static(repoUploadsDir));
}

// Crisp fallback SVGs for seeded sample DPR images if sample files aren't bundled in gitignored uploads/
const renderSampleDprSvg = (title, subtitle, accent) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" rx="24" fill="url(#bg)"/>
  <rect x="36" y="36" width="728" height="428" rx="18" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" stroke-dasharray="10 8"/>
  <rect x="64" y="64" width="240" height="36" rx="18" fill="rgba(255,255,255,0.14)"/>
  <text x="184" y="87" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#e2e8f0">NKD POWER • GTPL LUMINA</text>
  <rect x="280" y="155" width="240" height="140" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)"/>
  <path d="M320 265 L370 210 L420 250 L455 220 L490 265 Z" fill="rgba(255,255,255,0.35)"/>
  <circle cx="445" cy="192" r="14" fill="rgba(250,204,21,0.75)"/>
  <text x="400" y="348" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${title}</text>
  <text x="400" y="384" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#cbd5e1">${subtitle}</text>
  <text x="400" y="426" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#94a3b8">Site Progress Reference Photo • Upload live site photos via DPR Editor</text>
</svg>`;

app.get('/uploads/sample_dpr_1.jpg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(renderSampleDprSvg('Roxtec Material Unloading', 'Cellar Room • GTPL LUMINA Data Center (Airoli)', '#0369a1'));
});

app.get('/uploads/sample_dpr_2.jpg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(renderSampleDprSvg('11kV Trench Alignment & Shifting', 'Cellar Room Core Cutting • Engaged Manpower: 07', '#1d4ed8'));
});

app.use('/uploads', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Uploaded file not found: ${req.originalUrl}`
    });
});

app.get('/api/health', async (req, res) => {
    let database = 'unknown';
    let dbError = null;
    try {
        const db = require('./config/database');
        await Promise.race([
            db.query('SELECT 1'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB health check timeout')), 2000))
        ]);
        database = 'connected';
    } catch (err) {
        database = 'disconnected';
        dbError = err.message;
    }

    res.json({
        success: true,
        message: 'Backend API is running',
        frontendServed: Boolean(frontendDistDir),
        database,
        ...(dbError ? { dbError } : {})
    });
});

const serveApkHandler = (req, res) => {
    const candidateApks = [
        path.resolve(__dirname, 'public', 'NKD-CRM.apk'),
        path.resolve(__dirname, 'NKD-CRM.apk'),
        path.resolve(__dirname, '..', 'NKD-CRM.apk'),
        path.resolve(__dirname, '..', 'frontend', 'public', 'NKD-CRM.apk'),
        path.resolve(__dirname, '..', 'frontend', 'dist', 'NKD-CRM.apk'),
        path.resolve(process.cwd(), 'NKD-CRM.apk'),
        path.resolve(process.cwd(), 'public', 'NKD-CRM.apk'),
        path.resolve(process.cwd(), 'backend', 'NKD-CRM.apk'),
        path.resolve(process.cwd(), 'backend', 'public', 'NKD-CRM.apk')
    ];
    const apkPath = candidateApks.find(p => fs.existsSync(p));
    if (apkPath) {
        const stat = fs.statSync(apkPath);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'attachment; filename="NKD-CRM.apk"');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(apkPath);
    } else {
        res.status(404).json({
            success: false,
            message: 'Android APK build is not hosted on this server yet. Please use the mobile web PWA or ask your admin to attach NKD-CRM.apk.'
        });
    }
};

app.get('/api/download/apk', serveApkHandler);
app.get('/download/apk', serveApkHandler);
app.get('/NKD-CRM.apk', serveApkHandler);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', crmRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Unified single-domain serving: serve compiled React SPA build when present
const candidateFrontendDirs = [
    process.env.FRONTEND_DIST_DIR ? path.resolve(process.env.FRONTEND_DIST_DIR) : null,
    path.resolve(__dirname, '..', 'frontend', 'dist'),
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, 'dist')
].filter(Boolean);

const frontendDistDir = candidateFrontendDirs.find((dir) =>
    fs.existsSync(path.join(dir, 'index.html'))
) || null;

if (frontendDistDir) {
    app.use(express.static(frontendDistDir, {
        index: false,
        redirect: false,
        setHeaders: (res, filePath) => {
            const normalized = filePath.replace(/\\/g, '/');
            if (normalized.endsWith('/index.html') || normalized.endsWith('/sw.js') || normalized.endsWith('/manifest.json')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            } else if (normalized.includes('/assets/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    app.get('*', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }
        if (/^\/assets\/.+\.[a-z0-9]+$/i.test(req.path)) {
            return next();
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(path.join(frontendDistDir, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'NKD CRM API Server is live and operational (frontend build not found)',
            status: 'online',
            healthCheck: '/api/health'
        });
    });
}

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);

    if (err.name === 'MulterError') {
        const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file exceeds maximum allowed size limit (10MB).'
            : (err.message || 'File upload validation error');
        return res.status(statusCode).json({
            success: false,
            message: msg
        });
    }

    const databaseConnectionFailed = err.code === 'ECONNREFUSED'
        || err.cause?.code === 'ECONNREFUSED'
        || err.errors?.some?.(error => error.code === 'ECONNREFUSED');

    if (databaseConnectionFailed) {
        const target = process.env.DATABASE_URL
            ? 'cloud database (DATABASE_URL)'
            : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`;
        return res.status(503).json({
            success: false,
            message: `PostgreSQL database is not reachable at ${target}. Please configure your Database Environment Variables in Hostinger hPanel.`
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

    if (err.message?.includes('password authentication failed') || err.code === '28P01') {
        return res.status(503).json({
            success: false,
            message: 'Database password is incorrect. Please verify your Supabase database password in Hostinger Environment Variables.'
        });
    }

    if (err.code === 'ENOTFOUND' || err.message?.includes('getaddrinfo')) {
        return res.status(503).json({
            success: false,
            message: `Database host could not be reached (${err.hostname || 'DNS lookup failed'}). In Supabase, please use the Connection Pooler (Port 6543) instead of Direct connection.`
        });
    }

    if (databaseConnectionFailed) {
        return res.status(503).json({
            success: false,
            message: `Database connection failed (${err.message || 'connection refused'}). Please check your Supabase connection string in Hostinger.`
        });
    }

    return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port} and network http://0.0.0.0:${port}`);
    if (frontendDistDir) {
        console.log(`🌐 Serving unified React frontend from: ${frontendDistDir}`);
    } else {
        console.warn('⚠️ Frontend build folder not found; running in API-only mode.');
    }

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
