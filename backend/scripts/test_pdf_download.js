const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config({ path: __dirname + '/../.env' });

const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret';
const token = jwt.sign({ userId: 1, roleCode: 'ADMIN' }, jwtSecret);

http.get(`http://localhost:5000/api/recruitment/offers/1/pdf?token=${token}`, (res) => {
    console.log('HTTP Status Code:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Disposition:', res.headers['content-disposition']);
    let size = 0;
    res.on('data', chunk => size += chunk.length);
    res.on('end', () => {
        console.log('Total PDF bytes received:', size);
        process.exit(0);
    });
}).on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
});

