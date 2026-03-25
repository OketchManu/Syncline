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
        return res.status(401).json({ error: 'Access token required' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);

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
            return res.status(404).json({ error: 'User not found. Please complete registration.' });
        }

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
        console.error('Auth middleware error:', error.code || error.message);

        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: 'Token expired. Please sign in again.' });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            return res.status(403).json({ error: 'Invalid token.' });
        }
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