/**
 * PostgreSQL Database Configuration
 * Uses pg Pool for connection pooling
 */

const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Helper to safely parse and sanitize connection strings (handles '@' in passwords & quotes)
const sanitizeConnectionString = (urlStr) => {
  if (!urlStr) return null;
  let trimmed = String(urlStr).trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    trimmed = `postgresql://${trimmed}`;
  }

  const protoMatch = trimmed.match(/^(postgres(?:ql)?:\/\/)(.*)$/);
  if (!protoMatch) return trimmed;

  const body = protoMatch[2];
  const lastAt = body.lastIndexOf('@');
  if (lastAt === -1) return trimmed;

  const authPart = body.slice(0, lastAt);
  const hostAndRest = body.slice(lastAt + 1);

  const firstColon = authPart.indexOf(':');
  if (firstColon === -1) return trimmed;

  const user = authPart.slice(0, firstColon);
  const rawPass = authPart.slice(firstColon + 1);

  let cleanPass = rawPass;
  try {
    cleanPass = encodeURIComponent(decodeURIComponent(rawPass));
  } catch (_) {
    cleanPass = encodeURIComponent(rawPass);
  }

  return `${protoMatch[1]}${encodeURIComponent(decodeURIComponent(user))}:${cleanPass}@${hostAndRest}`;
};

// Detect if connection string is in DATABASE_URL or inadvertently placed in DB_HOST or DB_PASSWORD
const rawConnectionString = process.env.DATABASE_URL ||
  (process.env.DB_HOST && (process.env.DB_HOST.startsWith('postgres://') || process.env.DB_HOST.startsWith('postgresql://')) ? process.env.DB_HOST : null) ||
  (process.env.DB_PASSWORD && (process.env.DB_PASSWORD.startsWith('postgres://') || process.env.DB_PASSWORD.startsWith('postgresql://')) ? process.env.DB_PASSWORD : null);

const isUrlLike = rawConnectionString || (process.env.DB_HOST && process.env.DB_HOST.includes('@'));
const finalConnectionString = sanitizeConnectionString(rawConnectionString || (isUrlLike ? `postgresql://${process.env.DB_HOST}` : null));

// Debug: Show what database we're connecting to
console.log('🔍 Database Configuration:');
if (finalConnectionString) {
  console.log('   Using connection string (auto-detected for cloud database)');
} else {
  console.log('   DB_NAME from .env:', process.env.DB_NAME);
  console.log('   DB_USER:', process.env.DB_USER);
  console.log('   DB_HOST:', process.env.DB_HOST);
}

// Create PostgreSQL connection pool with cloud/Render support (DATABASE_URL & SSL)
const poolConfig = finalConnectionString
  ? {
      connectionString: finalConnectionString,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'NKD_CRM',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD ?? ''),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client:', err.message || err);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.DB_DEBUG === 'true') {
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

// Helper function to get a client from the pool (for transactions)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the release method to clear our timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return client;
};

module.exports = {
  pool,
  query,
  getClient,
};
