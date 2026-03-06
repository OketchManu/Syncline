// api/src/routes/auth.js
// COMPLETE VERSION - Supports both individual and company account registration

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, getOne } = require('../config/database');

// Helper function to generate company invite code
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ✅ REGISTER ENDPOINT - Handles both individual and company accounts
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, accountType, companyName } = req.body;

        // Validate required fields
        if (!email || !password || !fullName) {
            return res.status(400).json({ 
                error: 'Email, password, and full name are required' 
            });
        }

        // Validate company-specific requirements
        if (accountType === 'company' && !companyName) {
            return res.status(400).json({ 
                error: 'Company name is required for company accounts' 
            });
        }

        // Check if user already exists
        const existingUser = await getOne(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            return res.status(400).json({ 
                error: 'User already exists with this email' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine role based on account type
        const userRole = accountType === 'company' ? 'owner' : 'member';
        const userAccountType = accountType || 'individual';

        // Insert user (without company_id initially)
        const userResult = await runQuery(
            `INSERT INTO users (email, password_hash, full_name, account_type, role, created_at) 
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [email, hashedPassword, fullName, userAccountType, userRole]
        );

        const userId = userResult.id;
        let companyId = null;

        // If company account, create company and link to user
        if (accountType === 'company') {
            const inviteCode = generateInviteCode();
            
            const companyResult = await runQuery(
                `INSERT INTO companies (name, owner_id, invite_code, created_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [companyName, userId, inviteCode]
            );
            
            companyId = companyResult.id;

            // Update user with company_id
            await runQuery(
                'UPDATE users SET company_id = ? WHERE id = ?',
                [companyId, userId]
            );
        }

        // Generate JWT tokens
        const accessToken = jwt.sign(
            { userId, accountType: userAccountType },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { userId },
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
            { expiresIn: '7d' }
        );

        // Get complete user data
        const user = await getOne(
            `SELECT 
                id, 
                email, 
                full_name as fullName, 
                role, 
                account_type as accountType, 
                company_id as companyId,
                avatar_url
             FROM users 
             WHERE id = ?`,
            [userId]
        );

        // Add company info if company account
        if (accountType === 'company' && companyId) {
            const company = await getOne(
                'SELECT id, name, invite_code FROM companies WHERE id = ?',
                [companyId]
            );
            user.company = company;
        }

        res.status(201).json({
            message: 'User registered successfully',
            accessToken,
            refreshToken,
            user
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed. Please try again.' 
        });
    }
});

// ✅ LOGIN ENDPOINT - Returns accountType
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        // Get user
        const user = await getOne(
            `SELECT 
                id, 
                email, 
                password_hash,
                full_name as fullName, 
                role, 
                account_type as accountType, 
                company_id as companyId,
                avatar_url
             FROM users 
             WHERE email = ?`,
            [email]
        );

        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Remove password from user object
        delete user.password_hash;

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, accountType: user.accountType },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
            { expiresIn: '7d' }
        );

        // Get company info if user has company
        if (user.companyId) {
            const company = await getOne(
                'SELECT id, name, invite_code FROM companies WHERE id = ?',
                [user.companyId]
            );
            if (company) {
                user.company = company;
            }
        }

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed. Please try again.' 
        });
    }
});

// ✅ GET CURRENT USER (for auth verification)
router.get('/me', async (req, res) => {
    try {
        // Get userId from JWT token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        const user = await getOne(
            `SELECT 
                id, 
                email, 
                full_name as fullName, 
                role, 
                account_type as accountType, 
                company_id as companyId,
                avatar_url
             FROM users 
             WHERE id = ?`,
            [decoded.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get company info if user has company
        if (user.companyId) {
            const company = await getOne(
                'SELECT id, name, invite_code FROM companies WHERE id = ?',
                [user.companyId]
            );
            if (company) {
                user.company = company;
            }
        }

        res.json({ user });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// ✅ REFRESH TOKEN
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
        );

        // Get user account type
        const user = await getOne(
            'SELECT account_type FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: decoded.userId, accountType: user.account_type },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ accessToken });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

module.exports = router;