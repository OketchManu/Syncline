// api/src/routes/auth.routes.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { runQuery, getOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { admin }             = require('../config/firebase');

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
        `INSERT INTO companies (name, owner_id, invite_code, industry, size, description, website, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [companyName, userId, inviteCode, industry||null, size||null, description||null, website||null]
    );
    const companyId = companyResult.id;
    await runQuery('UPDATE users SET company_id = ?, org_id = ? WHERE id = ?', [companyId, companyId, userId]);
    try {
        await runQuery(
            `INSERT INTO company_members (company_id, user_id, role, status, joined_at)
             VALUES (?, ?, 'owner', 'active', CURRENT_TIMESTAMP)`,
            [companyId, userId]
        );
    } catch (_) {}
    return companyId;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const {
            email, password, fullName, firebaseUid,
            accountType, companyName, industry, size,
            description, website, avatar,
        } = req.body;

        if (!email || !fullName)             return res.status(400).json({ error: 'Email and full name are required' });
        if (!firebaseUid && !password)       return res.status(400).json({ error: 'Either firebaseUid or password is required' });
        if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const resolvedType = accountType === 'company' ? 'company' : 'personal';
        const role         = resolvedType === 'company' ? 'owner' : 'member';

        // ── Check for existing user ───────────────────────────────────────────
        const existing = await getOne(
            'SELECT * FROM users WHERE email = ? OR (firebase_uid IS NOT NULL AND firebase_uid = ?)',
            [email, firebaseUid || '']
        );

        if (existing) {
            if (firebaseUid && !existing.firebase_uid) {
                await runQuery(
                    'UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [firebaseUid, existing.id]
                );
                existing.firebase_uid = firebaseUid;
            }
            let company = null;
            if (existing.company_id) {
                company = await getOne('SELECT id, name, invite_code FROM companies WHERE id = ?', [existing.company_id]);
            }
            return res.json({ user: { ...sanitizeUser(existing), company: company || undefined } });
        }

        // ── Create new user ───────────────────────────────────────────────────
        let passwordHash = null;
        if (password) {
            const bcrypt = require('bcryptjs');
            passwordHash = await bcrypt.hash(password, 10);
        }

        const userResult = await runQuery(
            `INSERT INTO users (email, password_hash, full_name, account_type, role, firebase_uid, avatar_url, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [email, passwordHash, fullName, resolvedType, role, firebaseUid||null, avatar||null]
        );
        const userId = userResult.id;

        let companyId = null;
        if (resolvedType === 'company' && companyName) {
            companyId = await createCompany(userId, { companyName, industry, size, description, website });
        }

        const newUser = await getOne('SELECT * FROM users WHERE id = ?', [userId]);
        let company = null;
        if (companyId) {
            company = await getOne('SELECT id, name, invite_code FROM companies WHERE id = ?', [companyId]);
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

// ─── POST /api/auth/firebase-sync ─────────────────────────────────────────────
// Called by the frontend immediately after any Firebase sign-in.
// Does NOT use authenticateToken middleware — it verifies the token itself so
// first-time Google users (not yet in the DB) can pass through without a 403.
router.post('/firebase-sync', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        const idToken = authHeader.split('Bearer ')[1]?.trim();
        if (!idToken) return res.status(401).json({ error: 'Empty token' });

        // ── Verify the Firebase ID token ──────────────────────────────────────
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (tokenErr) {
            console.error('❌ firebase-sync: token verification failed:', tokenErr.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const firebaseUid = decoded.uid;
        const email       = decoded.email   || req.body?.email    || `${firebaseUid}@firebase.local`;
        const displayName = decoded.name    || req.body?.fullName || email.split('@')[0] || 'User';
        const avatarUrl   = decoded.picture || req.body?.avatar   || null;

        console.log('🔄 firebase-sync for UID:', firebaseUid, '| email:', email);

        // ── Look up existing user ─────────────────────────────────────────────
        let existing = await getOne('SELECT * FROM users WHERE firebase_uid = ?', [firebaseUid]);
        if (!existing && decoded.email) {
            existing = await getOne('SELECT * FROM users WHERE email = ?', [decoded.email]);
        }

        if (existing) {
            // Block deleted / anonymised accounts
            if (
                existing.email &&
                existing.email.startsWith('deleted_user_') &&
                existing.email.endsWith('@syncline.local')
            ) {
                console.warn('⚠️  firebase-sync blocked: deleted account attempted re-entry:', email);
                return res.status(403).json({ error: 'This account has been deleted and cannot be restored.' });
            }

            // Attach firebase_uid if this user was created via email/password
            if (!existing.firebase_uid) {
                await runQuery(
                    'UPDATE users SET firebase_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [firebaseUid, existing.id]
                );
                existing.firebase_uid = firebaseUid;
            }

            // Update last_seen
            await runQuery(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
                [existing.id]
            );

            let company = null;
            if (existing.company_id) {
                company = await getOne(
                    'SELECT id, name, invite_code, logo_url FROM companies WHERE id = ?',
                    [existing.company_id]
                );
            }

            console.log('✅ firebase-sync: existing user returned:', email);
            return res.json({ user: { ...sanitizeUser(existing), company: company || undefined }, created: false });
        }

        // ── Create new user ───────────────────────────────────────────────────
        let userResult;
        try {
            userResult = await runQuery(
                `INSERT INTO users (email, full_name, account_type, role, firebase_uid, avatar_url, is_active, created_at, last_seen)
                 VALUES (?, ?, 'personal', 'member', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [email, displayName, firebaseUid, avatarUrl]
            );
        } catch (insertErr) {
            // Race condition: another request already created this user
            if (insertErr.message.includes('UNIQUE constraint')) {
                const raceUser = await getOne(
                    'SELECT * FROM users WHERE firebase_uid = ? OR email = ?',
                    [firebaseUid, email]
                );
                if (raceUser) return res.json({ user: sanitizeUser(raceUser), created: false });
            }
            throw insertErr;
        }

        const newUser = await getOne('SELECT * FROM users WHERE id = ?', [userResult.id]);
        console.log('✅ firebase-sync: new user created:', email);
        return res.status(201).json({ user: sanitizeUser(newUser), created: true });

    } catch (error) {
        console.error('❌ firebase-sync error:', error.message, error.stack);
        res.status(500).json({ error: 'Sync failed', details: error.message });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
    try {
        let user = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);

        // Fallback: look up by firebase_uid
        if (!user && req.user.firebase_uid) {
            user = await getOne('SELECT * FROM users WHERE firebase_uid = ?', [req.user.firebase_uid]);
            if (user) console.log('ℹ️  /me: found user by firebase_uid fallback');
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found. Please complete registration.' });
        }

        if (
            user.email &&
            user.email.startsWith('deleted_user_') &&
            user.email.endsWith('@syncline.local')
        ) {
            return res.status(403).json({ error: 'This account has been deleted.' });
        }

        // Refresh last_seen
        await runQuery('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        let company = null;
        if (user.company_id) {
            company = await getOne(
                'SELECT id, name, invite_code, industry, size, description, website, logo_url FROM companies WHERE id = ?',
                [user.company_id]
            );
        }

        res.json({ user: { ...sanitizeUser(user), company: company || undefined } });
    } catch (error) {
        console.error('❌ /me error:', error);
        res.status(500).json({ error: 'Failed to get user', details: error.message });
    }
});

// ─── DELETE /api/auth/delete-firebase-user ────────────────────────────────────
router.delete('/delete-firebase-user', authenticateToken, async (req, res) => {
    try {
        const firebaseUid = req.user.firebase_uid || req.body?.firebaseUid;
        if (!firebaseUid) return res.status(400).json({ error: 'No Firebase UID associated.' });

        try {
            await admin.auth().deleteUser(firebaseUid);
        } catch (firebaseErr) {
            if (firebaseErr.code !== 'auth/user-not-found') throw firebaseErr;
        }

        res.json({ message: 'Firebase Auth account permanently deleted.' });
    } catch (err) {
        console.error('❌ /delete-firebase-user error:', err);
        res.status(500).json({ error: err.message || 'Deletion failed.' });
    }
});

// ─── Misc ─────────────────────────────────────────────────────────────────────
router.post('/logout',  (req, res) => res.json({ message: 'Logged out successfully.' }));
router.post('/refresh', (req, res) => res.status(410).json({ error: 'Handled by Firebase.' }));
router.post('/login',   (req, res) => res.status(410).json({ error: 'Handled by Firebase.' }));

module.exports = router;