// api/src/routes/auth.routes.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { runQuery, getOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { admin }             = require('../config/firebase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteCode() {
    return 'SYNC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sanitizeUser(user) {
    if (!user) return null;
    const accountType = user.account_type === 'company' ? 'company' : 'personal';
    return {
        id:           user.id,
        email:        user.email,
        fullName:     user.full_name || user.fullName,
        full_name:    user.full_name || user.fullName,
        role:         user.role         || 'member',
        accountType,
        account_type: accountType,
        companyId:    user.company_id   || null,
        company_id:   user.company_id   || null,
        orgId:        user.org_id       || null,
        org_id:       user.org_id       || null,
        avatar:       user.avatar_url   || null,
        avatar_url:   user.avatar_url   || null,
        firebaseUid:  user.firebase_uid || null,
        isActive:     user.is_active !== 0,
        createdAt:    user.created_at,
        lastSeen:     user.last_seen,
    };
}

async function createCompany(userId, { companyName, industry, size, description, website }) {
    const inviteCode    = generateInviteCode();
    const companyResult = await runQuery(
        `INSERT INTO companies
            (name, owner_id, invite_code, industry, size, description, website, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [companyName, userId, inviteCode, industry||null, size||null, description||null, website||null]
    );
    const companyId = companyResult.id;
    await runQuery(
        'UPDATE users SET company_id = ?, org_id = ? WHERE id = ?',
        [companyId, companyId, userId]
    );
    try {
        await runQuery(
            `INSERT INTO company_members (company_id, user_id, role, status, joined_at)
             VALUES (?, ?, 'owner', 'active', CURRENT_TIMESTAMP)`,
            [companyId, userId]
        );
    } catch (_) {}
    return companyId;
}

// ─── Helper: verify bearer token ─────────────────────────────────────────────
async function verifyBearerToken(req, res) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return null;
    }
    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
        res.status(401).json({ error: 'Empty token' });
        return null;
    }
    try {
        return await admin.auth().verifyIdToken(idToken);
    } catch (err) {
        console.error('❌ Token verification failed:', err.message);
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const {
            email, password, fullName,
            firebaseUid, accountType,
            companyName, industry, size, description, website,
            avatar,
        } = req.body;

        console.log('Register:', { email, accountType, hasFirebaseUid: !!firebaseUid });

        if (!email || !fullName) {
            return res.status(400).json({ error: 'Email and full name are required' });
        }
        if (!firebaseUid && !password) {
            return res.status(400).json({ error: 'Either firebaseUid or password is required' });
        }
        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const resolvedType = accountType === 'company' ? 'company' : 'personal';
        const role         = resolvedType === 'company' ? 'owner' : 'member';

        // Check if user already exists
        const existing = await getOne(
            'SELECT * FROM users WHERE email = ? OR (firebase_uid IS NOT NULL AND firebase_uid = ?)',
            [email, firebaseUid || '']
        );

        if (existing) {
            if (firebaseUid && !existing.firebase_uid) {
                await runQuery(
                    'UPDATE users SET firebase_uid = ? WHERE id = ?',
                    [firebaseUid, existing.id]
                );
                existing.firebase_uid = firebaseUid;
            }
            let company = null;
            if (existing.company_id) {
                company = await getOne(
                    'SELECT id, name, invite_code FROM companies WHERE id = ?',
                    [existing.company_id]
                );
            }
            return res.json({ user: { ...sanitizeUser(existing), company: company || undefined } });
        }

        // Hash password if provided
        let passwordHash = null;
        if (password) {
            const bcrypt = require('bcryptjs');
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Create user row
        const userResult = await runQuery(
            `INSERT INTO users
                (email, password_hash, full_name, account_type, role,
                 firebase_uid, avatar_url, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [email, passwordHash, fullName, resolvedType, role, firebaseUid||null, avatar||null]
        );
        const userId = userResult.id;

        // Create company if needed
        let companyId = null;
        if (resolvedType === 'company' && companyName) {
            companyId = await createCompany(userId, { companyName, industry, size, description, website });
        }

        const newUser = await getOne('SELECT * FROM users WHERE id = ?', [userId]);
        let company = null;
        if (companyId) {
            company = await getOne(
                'SELECT id, name, invite_code FROM companies WHERE id = ?',
                [companyId]
            );
        }

        console.log('✅ User created:', { id: userId, email });
        return res.status(201).json({
            message: 'User registered successfully',
            user: { ...sanitizeUser(newUser), company: company || undefined },
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
});

// ─── POST /api/auth/google-login ──────────────────────────────────────────────
// LOGIN ONLY — looks up existing users, NEVER creates one.
// Returns 404 { registered: false, googleProfile: {...} } when no account exists,
// so the frontend can redirect to /register with pre-filled Google data.
router.post('/google-login', async (req, res) => {
    try {
        const decoded = await verifyBearerToken(req, res);
        if (!decoded) return; // response already sent by helper

        const firebaseUid = decoded.uid;
        const email       = decoded.email || req.body?.email || null;

        console.log('🔍 google-login lookup for UID:', firebaseUid, '| email:', email);

        // Look up by firebase_uid first, then email
        let existing = await getOne(
            'SELECT * FROM users WHERE firebase_uid = ?',
            [firebaseUid]
        );

        if (!existing && email) {
            existing = await getOne(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
        }

        // ── Not registered — tell frontend to redirect to /register ───────────
        if (!existing) {
            console.log('ℹ️  google-login: no account found for', email || firebaseUid);
            return res.status(404).json({
                registered: false,
                error:      'No account found. Please register first.',
                googleProfile: {
                    email:      decoded.email   || null,
                    fullName:   decoded.name    || null,
                    avatar:     decoded.picture || null,
                    firebaseUid,
                },
            });
        }

        // ── Existing user — link UID if missing, return full profile ──────────
        if (!existing.firebase_uid) {
            await runQuery(
                'UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [firebaseUid, existing.id]
            );
            existing.firebase_uid = firebaseUid;
        }

        let company = null;
        if (existing.company_id) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website FROM companies WHERE id = ?',
                [existing.company_id]
            );
        }

        console.log('✅ google-login: existing user found:', email);
        return res.json({
            registered: true,
            user: { ...sanitizeUser(existing), company: company || undefined },
        });

    } catch (error) {
        console.error('❌ google-login error:', error.message);
        res.status(500).json({ error: 'Google login failed', details: error.message });
    }
});

// ─── POST /api/auth/firebase-sync ─────────────────────────────────────────────
// REGISTER path only — called during sign-up to create a new user row.
// Never call this from the login flow.
router.post('/firebase-sync', async (req, res) => {
    try {
        const decoded = await verifyBearerToken(req, res);
        if (!decoded) return;

        const firebaseUid = decoded.uid;

        const email = decoded.email
            || req.body?.email
            || `${firebaseUid}@firebase.local`;

        const displayName = decoded.name
            || req.body?.fullName
            || email.split('@')[0]
            || 'User';

        const avatarUrl = decoded.picture || req.body?.avatar || null;

        console.log('🔄 firebase-sync for UID:', firebaseUid, '| email:', email);

        // Check if user already exists (by UID first, then email)
        let existing = await getOne(
            'SELECT * FROM users WHERE firebase_uid = ?',
            [firebaseUid]
        );

        if (!existing && decoded.email) {
            existing = await getOne(
                'SELECT * FROM users WHERE email = ?',
                [decoded.email]
            );
        }

        if (existing) {
            if (!existing.firebase_uid) {
                await runQuery(
                    'UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [firebaseUid, existing.id]
                );
                existing.firebase_uid = firebaseUid;
            }

            let company = null;
            if (existing.company_id) {
                company = await getOne(
                    'SELECT id, name, invite_code FROM companies WHERE id = ?',
                    [existing.company_id]
                );
            }

            console.log('✅ firebase-sync: existing user returned:', email);
            return res.json({
                user:    { ...sanitizeUser(existing), company: company || undefined },
                created: false,
            });
        }

        // Create new user row
        let userResult;
        try {
            userResult = await runQuery(
                `INSERT INTO users
                    (email, full_name, account_type, role,
                     firebase_uid, avatar_url, is_active, created_at)
                 VALUES (?, ?, 'personal', 'member', ?, ?, 1, CURRENT_TIMESTAMP)`,
                [email, displayName, firebaseUid, avatarUrl]
            );
        } catch (insertErr) {
            if (insertErr.message.includes('UNIQUE constraint')) {
                const raceUser = await getOne(
                    'SELECT * FROM users WHERE firebase_uid = ? OR email = ?',
                    [firebaseUid, email]
                );
                if (raceUser) {
                    console.log('✅ firebase-sync: race condition resolved for:', email);
                    return res.json({ user: sanitizeUser(raceUser), created: false });
                }
            }
            throw insertErr;
        }

        const newUser = await getOne('SELECT * FROM users WHERE id = ?', [userResult.id]);

        console.log('✅ firebase-sync: new user created:', email);
        return res.status(201).json({
            user:    sanitizeUser(newUser),
            created: true,
        });

    } catch (error) {
        console.error('❌ firebase-sync error:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Sync failed', details: error.message });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let company = null;
        if (user.company_id) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website FROM companies WHERE id = ?',
                [user.company_id]
            );
        }

        res.json({ user: { ...sanitizeUser(user), company: company || undefined } });
    } catch (error) {
        console.error('❌ /me error:', error);
        res.status(500).json({ error: 'Failed to get user', details: error.message });
    }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully.' });
});

// ─── POST /api/auth/refresh — kept for backwards compat ──────────────────────
router.post('/refresh', (req, res) => {
    res.status(410).json({ error: 'Token refresh is handled automatically by Firebase.' });
});

// ─── POST /api/auth/login — kept for backwards compat ────────────────────────
router.post('/login', (req, res) => {
    res.status(410).json({ error: 'Login is now handled by Firebase on the client.' });
});

module.exports = router;