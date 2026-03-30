// api/src/middleware/auth.js
const admin = require('firebase-admin');
const { db } = require('../config/database');

// ─── Initialise Firebase Admin (once) ────────────────────────────────────────
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../../serviceAccountKey.json');
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('✅ Firebase Admin initialised (service account file)');
    } catch (_) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('✅ Firebase Admin initialised (env variable)');
        } else {
            admin.initializeApp();
            console.log('✅ Firebase Admin initialised (application default credentials)');
        }
    }
}

// ─── Main auth middleware ─────────────────────────────────────────────────────
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('⚠️  No Bearer token in Authorization header');
        return res.status(401).json({ error: 'Access token required' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('🔍 Received token (first 50 chars):', idToken.substring(0, 50) + '...');
    console.log('🔍 Token length:', idToken.length);

    try {
        console.log('🔐 Attempting to verify Firebase ID token...');
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log('✅ Token verified! Firebase UID:', decoded.uid);

        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, full_name, role, account_type,
                        company_id, org_id, avatar_url, firebase_uid
                 FROM users WHERE firebase_uid = ?`,
                [decoded.uid],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            console.warn('⚠️  User not found in database for Firebase UID:', decoded.uid);
            return res.status(404).json({ error: 'User not found. Please complete registration.' });
        }

        console.log('✅ User found in database:', user.email);

        req.user = {
            id:           user.id,
            email:        user.email,
            fullName:     user.full_name,
            role:         user.role,
            accountType:  user.account_type,
            account_type: user.account_type,
            company_id:   user.company_id || null,
            org_id:       user.org_id     || null,
            avatar_url:   user.avatar_url || null,
            firebaseUid:  decoded.uid,
        };

        next();
    } catch (error) {
        console.error('❌ Auth middleware error:');
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        console.error('   Full error:', error);

        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            console.warn('⚠️  Token expired or revoked');
            return res.status(401).json({ error: 'Token expired. Please sign in again.' });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            console.warn('⚠️  Invalid token format or structure');
            return res.status(403).json({ error: 'Invalid token.' });
        }
        console.warn('⚠️  Generic authentication failure');
        return res.status(403).json({ error: 'Authentication failed.' });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!allowedRoles.includes(req.user.role))
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        next();
    };
}

module.exports = { authenticateToken, requireRole };