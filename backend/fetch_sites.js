const { pool } = require('./config/database');

async function fetchSites() {
    try {
        const res = await pool.query('SELECT * FROM sites');
        console.log("Sites:", res.rows);
    } catch (err) {
        console.error("Error fetching sites:", err);
    } finally {
        await pool.end();
    }
}

fetchSites();
