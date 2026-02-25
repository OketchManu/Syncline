// api/src/routes/auth.routes.js
// Authentication endpoints: login, register, refresh token

const express = require('express');
const router = express.Router();
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../config/jwt');
const { createUser, findByEmail, verifyPassword, findById } = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password || !fullName) {
            return res.status(400).json({ 
                error: 'Email, password, and full name are required' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters long' 
            });
        }

        // Check if user already exists
        const existingUser = await findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ 
                error: 'User with this email already exists' 
            });
        }

        // Create user
        const userId = await createUser(email, password, fullName, 'member');

        // Generate tokens
        const accessToken = generateAccessToken(userId, email, 'member');
        const refreshToken = generateRefreshToken(userId);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: userId,
                email,
                fullName,
                role: 'member'
            },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed',
            details: error.message 
        });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        // Find user
        const user = await findByEmail(email);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({ 
                error: 'Account is deactivated' 
            });
        }

        // Verify password
        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.email, user.role);
        const refreshToken = generateRefreshToken(user.id);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed',
            details: error.message 
        });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ 
                error: 'Refresh token is required' 
            });
        }

        // Verify refresh token
        const decoded = verifyToken(refreshToken);

        if (decoded.type !== 'refresh') {
            return res.status(403).json({ 
                error: 'Invalid token type' 
            });
        }

        // Get user
        const user = await findById(decoded.userId);
        if (!user || !user.is_active) {
            return res.status(403).json({ 
                error: 'Invalid refresh token' 
            });
        }

        // Generate new access token
        const newAccessToken = generateAccessToken(user.id, user.email, user.role);

        res.json({
            accessToken: newAccessToken
        });

    } catch (error) {
        if (error.message === 'Token expired') {
            return res.status(401).json({ 
                error: 'Refresh token expired. Please login again.' 
            });
        }
        res.status(403).json({ 
            error: 'Invalid refresh token',
            details: error.message 
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                lastSeen: user.last_seen,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            error: 'Failed to get user info',
            details: error.message 
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user (protected route)
 * Note: JWT tokens can't be invalidated server-side, so client should delete token
 */
router.post('/logout', authenticateToken, (req, res) => {
    res.json({
        message: 'Logged out successfully. Please delete your token on the client side.'
    });
});

module.exports = router;