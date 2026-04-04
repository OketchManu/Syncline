// api/src/middleware/auth.js
const { admin } = require('../config/firebase');
const { db }    = require('../config/database');

// ─── Main auth middleware ─────────────────────────────────────────────────────
async function authenticateToken(req, res, next) {
    if (!admin || !admin.apps || !admin.apps.length) {
        console.error('❌ Firebase Admin not initialized');
        return res.status(500).json({ error: 'Authentication service unavailable. Please try again later.' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'You must be signed in to access this resource.' });
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
        return res.status(401).json({ error: 'Authentication token is missing. Please sign in again.' });
    }

    console.log('🔍 Token received (first 50 chars):', idToken.substring(0, 50) + '...');

    try {
        console.log('🔐 Verifying Firebase ID token with admin.auth()...');
        const decoded = await admin.auth().verifyIdToken(idToken);

        console.log('✅ Token verified successfully');
        console.log('   Firebase UID:', decoded.uid);
        console.log('   Token aud (audience):', decoded.aud);

        // Fetch user from database by firebase_uid
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, full_name, role, account_type,
                        company_id, org_id, avatar_url, firebase_uid, is_active
                 FROM users
                 WHERE firebase_uid = ?
                   AND email NOT LIKE 'deleted_user_%@syncline.local'`,
                [decoded.uid],
                (err, row) => {
                    if (err) { console.error('❌ Database query error:', err.message); reject(err); }
                    else resolve(row);
                }
            );
        });

        if (!user) {
            console.warn('⚠️  User not found in database for Firebase UID:', decoded.uid);
            // Return a clear error that the frontend can detect
            return res.status(404).json({
                error:      'Account not found. Please register to continue.',
                code:       'USER_NOT_FOUND',
                firebaseUid: decoded.uid,
            });
        }

        // Block deleted/deactivated accounts
        if (user.is_active === 0) {
            console.warn('⚠️  Deactivated account attempted access:', user.email);
            return res.status(403).json({
                error: 'Your account has been deactivated. Please contact support.',
                code:  'ACCOUNT_DEACTIVATED',
            });
        }

        console.log('✅ User found in database:', user.email);

        req.user = {
            id:           user.id,
            email:        user.email,
            fullName:     user.full_name,
            full_name:    user.full_name,
            role:         user.role || 'member',
            accountType:  user.account_type,
            account_type: user.account_type,
            company_id:   user.company_id || null,
            org_id:       user.org_id     || null,
            avatar_url:   user.avatar_url || null,
            is_active:    user.is_active  !== 0,
            firebaseUid:  decoded.uid,
        };

        next();

    } catch (error) {
        console.error('❌ Auth middleware error:');
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'TOKEN_EXPIRED' });
        }
        if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: 'Your session was revoked. Please sign in again.', code: 'TOKEN_REVOKED' });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            return res.status(403).json({ error: 'Invalid authentication token. Please sign in again.', code: 'INVALID_TOKEN' });
        }

        return res.status(403).json({ error: 'Authentication failed. Please sign in again.', code: error.code });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'You must be signed in.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `This action requires one of these roles: ${allowedRoles.join(', ')}. Your current role is: ${req.user.role}.`,
            });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };