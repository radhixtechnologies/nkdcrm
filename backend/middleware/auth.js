const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'change-this-dev-secret';

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : (req.query.token || req.headers['x-access-token'] || null);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication token is required'
        });
    }

    try {
        req.user = jwt.verify(token, jwtSecret);
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

const requireRole = (...roleCodes) => (req, res, next) => {
    if (!req.user || !roleCodes.includes(req.user.roleCode)) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to perform this action'
        });
    }

    return next();
};

module.exports = {
    authenticate,
    requireRole
};
