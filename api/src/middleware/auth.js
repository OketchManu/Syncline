// api/src/middleware/auth.js
const admin = require('firebase-admin');
const { db } = require('../config/database');

// ��── Initialise Firebase Admin (once) ────────────────────────────────────────
let isFirebaseInitialized = false;

if (!admin.apps.length) {
    try {
        const serviceAccount = require('../../serviceAccountKey.json');
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        isFirebaseInitialized = true;
        console.log('✅ Firebase Admin initialised (service account file)');
        console.log('   Project ID:', serviceAccount.project_id);
    } catch (err) {
        console.warn('⚠️  Service account file not found, trying env variable...');
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
                isFirebaseInitialized = true;
                console.log('✅ Firebase Admin initialised (env variable)');
                console.log('   Project ID:', serviceAccount.project_id);
            } catch (parseErr) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseErr.message);
                try {
                    admin.initializeApp();
                    isFirebaseInitialized = true;
                    console.log('✅ Firebase Admin initialised (application default credentials)');
                } catch (defaultErr) {
                    console.error('❌ Failed to initialize Firebase Admin:', defaultErr.message);
                }
            }
        } else {
            console.warn('⚠️  No FIREBASE_SERVICE_ACCOUNT env var, trying default credentials...');
            try {
                admin.initializeApp();
                isFirebaseInitialized = true;
                console.log('✅ Firebase Admin initialised (application default credentials)');
            } catch (defaultErr) {
                console.error('❌ Failed to initialize Firebase Admin:', defaultErr.message);
            }
        }
    }
}

// ─── Main auth middleware ─────────────────────────────────────────────────────
async function authenticateToken(req, res, next) {
    // Check if Firebase is initialized
    if (!isFirebaseInitialized || !admin.apps.length) {
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
        console.log('   Token iss (issuer):', decoded.iss);

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
            console.warn('   This user exists in Firebase but not in our database');
            console.warn('   They need to complete registration first');
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

        console.log('✅ Auth middleware complete, user attached to request');
        next();

    } catch (error) {
        console.error('❌ Auth middleware error:');
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        
        // Helpful diagnostics
        if (error.code === 'auth/invalid-id-token') {
            console.error('   → Token format is invalid');
        } else if (error.code === 'auth/argument-error') {
            console.error('   → Token is malformed or project_id mismatch');
            console.error('   → Verify service account project_id matches frontend');
        } else if (error.code === 'auth/id-token-expired') {
            console.error('   → Token has expired');
        } else if (error.code === 'auth/id-token-revoked') {
            console.error('   → Token has been revoked');
        }

        // Return appropriate error based on error code
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: 'Token expired. Please sign in again.' });
        }
        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            return res.status(403).json({ error: 'Invalid token.' });
        }

        // Generic failure
        return res.status(403).json({ error: 'Authentication failed.', code: error.code });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            console.warn('❌ No user in request (requireRole middleware)');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            console.warn('❌ User role not allowed:', { userRole: req.user.role, allowedRoles });
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRole };