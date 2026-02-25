// api/src/middleware/auth.js
// Authentication middleware to protect routes

const { verifyToken } = require('../config/jwt');
const { getOne } = require('../config/database');

/**
 * Middleware to verify JWT token
 */
async function authenticateToken(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        const decoded = verifyToken(token);

        // Check if user still exists
        const user = await getOne(
            'SELECT id, email, full_name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid token. User not found.' 
            });
        }

        if (!user.is_active) {
            return res.status(403).json({ 
                error: 'Account is deactivated.' 
            });
        }

        // Attach user info to request
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        };

        next();
    } catch (error) {
        if (error.message === 'Token expired') {
            return res.status(401).json({ 
                error: 'Token expired. Please login again.' 
            });
        }
        return res.status(403).json({ 
            error: 'Invalid token.',
            details: error.message 
        });
    }
}

/**
 * Middleware to check if user has required role
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.' 
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions.',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
}

/**
 * Optional authentication (doesn't fail if no token)
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = verifyToken(token);
            const user = await getOne(
                'SELECT id, email, full_name, role FROM users WHERE id = ? AND is_active = 1',
                [decoded.userId]
            );

            if (user) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role
                };
            }
        }
    } catch (error) {
        // Silently fail for optional auth
    }
    next();
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};