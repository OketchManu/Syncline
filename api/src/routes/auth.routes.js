// api/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { runQuery, getOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────
// JWT HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function generateAccessToken(userId, email, role, companyId, accountType) {
    return jwt.sign(
        {
            userId,
            email,
            role,
            company_id: companyId || null,
            account_type: accountType || 'individual'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function generateRefreshToken(userId) {
    return jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Generate unique invite code
// ─────────────────────────────────────────────────────────────────

function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Sanitize user object for response
// ─────────────────────────────────────────────────────────────────

function sanitizeUser(user) {
    if (!user) return null;
    
    return {
        id: user.id,
        email: user.email,
        fullName: user.full_name || user.fullName,
        role: user.role || 'member',
        accountType: user.account_type || user.accountType || 'individual',
        companyId: user.company_id || user.companyId || null,
        avatar: user.avatar_url || user.avatar || null,
        isActive: user.is_active !== 0,
        createdAt: user.created_at || user.createdAt,
        lastSeen: user.last_seen || user.lastSeen
    };
}

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Supports both individual and company accounts
// ─────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            fullName,
            accountType,
            companyName,
            industry,
            size,
            description,
            website
        } = req.body;

        console.log('📝 Registration request:', { email, accountType, companyName });

        // Validate required fields
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
            return res.status(409).json({
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine account type and role
        const userAccountType = accountType === 'company' ? 'company' : 'individual';
        const userRole = accountType === 'company' ? 'owner' : 'member';

        console.log('👤 Creating user:', { email, accountType: userAccountType, role: userRole });

        // Create user (without company_id initially)
        const userResult = await runQuery(
            `INSERT INTO users (
                email, 
                password_hash, 
                full_name, 
                account_type, 
                role, 
                is_active,
                created_at
            ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [email, hashedPassword, fullName, userAccountType, userRole]
        );

        const userId = userResult.id;
        let companyId = null;

        // If company account, create company and link to user
        if (accountType === 'company') {
            const inviteCode = generateInviteCode();

            console.log('🏢 Creating company:', { name: companyName, inviteCode });

            const companyResult = await runQuery(
                `INSERT INTO companies (
                    name, 
                    owner_id, 
                    invite_code,
                    industry,
                    size,
                    description,
                    website,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    companyName,
                    userId,
                    inviteCode,
                    industry || null,
                    size || null,
                    description || null,
                    website || null
                ]
            );

            companyId = companyResult.id;

            console.log('🔗 Linking user to company:', { userId, companyId });

            // Update user with company_id
            await runQuery(
                'UPDATE users SET company_id = ? WHERE id = ?',
                [companyId, userId]
            );
        }

        // Fetch complete user data (with company_id if applicable)
        const user = await getOne(
            `SELECT 
                id, 
                email, 
                full_name, 
                role, 
                account_type, 
                company_id,
                avatar_url,
                is_active,
                created_at
            FROM users 
            WHERE id = ?`,
            [userId]
        );

        console.log('✅ User created:', { id: user.id, email: user.email, company_id: user.company_id });

        // Generate JWT tokens with company_id
        const accessToken = generateAccessToken(
            userId,
            email,
            userRole,
            companyId,
            userAccountType
        );

        const refreshToken = generateRefreshToken(userId);

        // Get company info if company account
        let company = null;
        if (companyId) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website FROM companies WHERE id = ?',
                [companyId]
            );
            console.log('🏢 Company details:', company);
        }

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                ...sanitizeUser(user),
                company: company || undefined
            },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            details: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Returns user with company info and proper JWT
// ─────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        console.log('🔐 Login attempt:', email);

        // Get user with all fields
        const user = await getOne(
            `SELECT 
                id, 
                email, 
                password_hash,
                full_name, 
                role, 
                account_type, 
                company_id,
                avatar_url,
                is_active,
                created_at,
                last_seen
            FROM users 
            WHERE email = ?`,
            [email]
        );

        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (user.is_active === 0) {
            return res.status(403).json({
                error: 'Account is deactivated. Please contact support.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        console.log('✅ Login successful:', { email, company_id: user.company_id });

        // Update last seen
        await runQuery(
            'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generate tokens with company_id
        const accessToken = generateAccessToken(
            user.id,
            user.email,
            user.role,
            user.company_id,
            user.account_type
        );

        const refreshToken = generateRefreshToken(user.id);

        // Get company info if user has company
        let company = null;
        if (user.company_id) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website FROM companies WHERE id = ?',
                [user.company_id]
            );
        }

        res.json({
            message: 'Login successful',
            user: {
                ...sanitizeUser(user),
                company: company || undefined
            },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            details: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Get current user info
// ─────────────────────────────────────────────────────────────────

router.get('/me', authenticateToken, async (req, res) => {
    try {
        console.log('👤 Get /me for user:', req.user.id);

        const user = await getOne(
            `SELECT 
                id, 
                email, 
                full_name, 
                role, 
                account_type, 
                company_id,
                avatar_url,
                is_active,
                created_at,
                last_seen
            FROM users 
            WHERE id = ?`,
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get company info if user has company
        let company = null;
        if (user.company_id) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website FROM companies WHERE id = ?',
                [user.company_id]
            );
        }

        res.json({
            user: {
                ...sanitizeUser(user),
                company: company || undefined
            }
        });

    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({
            error: 'Failed to get user data',
            details: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// Refresh access token
// ─────────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );

        if (decoded.type !== 'refresh') {
            return res.status(403).json({
                error: 'Invalid token type'
            });
        }

        // Get fresh user data
        const user = await getOne(
            `SELECT 
                id, 
                email, 
                role, 
                account_type, 
                company_id,
                is_active
            FROM users 
            WHERE id = ?`,
            [decoded.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_active === 0) {
            return res.status(403).json({
                error: 'Account is deactivated'
            });
        }

        console.log('🔄 Refreshing token for:', { email: user.email, company_id: user.company_id });

        // Generate new access token with fresh company_id
        const accessToken = generateAccessToken(
            user.id,
            user.email,
            user.role,
            user.company_id,
            user.account_type
        );

        res.json({ accessToken });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Refresh token expired. Please login again.'
            });
        }
        console.error('❌ Refresh token error:', error);
        res.status(403).json({
            error: 'Invalid refresh token',
            details: error.message
        });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Logout user
// ─────────────────────────────────────────────────────────────────

router.post('/logout', authenticateToken, (req, res) => {
    console.log('👋 User logged out:', req.user.email);
    res.json({
        message: 'Logged out successfully. Please delete your token on the client side.'
    });
});

module.exports = router;