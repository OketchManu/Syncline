// api/src/config/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET          = process.env.JWT_SECRET || 'Here';
const JWT_EXPIRES_IN      = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

function generateAccessToken(userId, email, role, companyId = null) {
    return jwt.sign(
        {
            userId,
            email,
            role,
            company_id: companyId,
            type: 'access'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function generateRefreshToken(userId) {
    return jwt.sign(
        { userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') throw new Error('Token expired');
        if (error.name === 'JsonWebTokenError')  throw new Error('Invalid token');
        throw error;
    }
}

function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    decodeToken,
    JWT_SECRET,
    JWT_EXPIRES_IN
};