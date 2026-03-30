// api/src/middleware/auth.js
const { admin } = require('../config/firebase');
const { db } = require('../config/database');

// ─── Main auth middleware ─────────────────────────────────────────────────────
async function authenticateToken(req, res, next) {
    // Check if Firebase is initialized
    if (!admin.apps.length) {
        console.error('❌ Firebase Admin not initialized');
        return res.status(500).json({ error: 'Authentication service unavailable' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('⚠️  Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Access token required' });
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    
    if (!idToken) {
        console.warn('⚠️  Empty token after Bearer split');
        return res.status(401).json({ error: 'Access token required' });
    }

    console.log('🔍 Token received (first 50 chars):', idToken.substring(0, 50) + '...');

    try {
        console.log('🔐 Verifying Firebase ID token with admin.auth()...');
        const decoded = await admin.auth().verifyIdToken(idToken);
        
        console.log('✅ Token verified successfully');
        console.log('   Firebase UID:', decoded.uid);
        console.log('   Token aud (audience):', decoded.aud);

        // Fetch user from database
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, full_name, role, account_type,
                        company_id, org_id, avatar_url, firebase_uid, is_active
                 FROM users WHERE firebase_uid = ?`,
                [decoded.uid],
                (err, row) => {
                    if (err) {
                        console.error('❌ Database query error:', err.message);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

        if (!user) {
            console.warn('⚠️  User not found in database for Firebase UID:', decoded.uid);
            return res.status(404).json({ 
                error: 'User not found. Please complete registration.',
                firebaseUid: decoded.uid 
            });
        }

        console.log('✅ User found in database:', user.email);

        // Attach user to request
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
            is_active:    user.is_active !== 0,
            firebaseUid:  decoded.uid,
        };

        next();

    } catch (error) {
        console.error('❌ Auth middleware error:');
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: 'Token expired. Please sign in again.' });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            console.error('   → Token is invalid or malformed');
            return res.status(403).json({ error: 'Invalid token.' });
        }

        return res.status(403).json({ error: 'Authentication failed.', code: error.code });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };