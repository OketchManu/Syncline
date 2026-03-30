// api/src/config/firebase.js
const admin = require('firebase-admin');

let isInitialized = false;

function initializeFirebase() {
    if (isInitialized || admin.apps.length) {
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialised (service account file)');
        console.log('   Project ID:', serviceAccount.project_id);
        isInitialized = true;
    } catch (err) {
        console.warn('⚠️  Service account file not found, trying env variable...');
        
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('✅ Firebase Admin initialised (env variable)');
                console.log('   Project ID:', serviceAccount.project_id);
                isInitialized = true;
            } catch (parseErr) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseErr.message);
                throw parseErr;
            }
        } else {
            console.warn('⚠️  No FIREBASE_SERVICE_ACCOUNT env var, trying default credentials...');
            try {
                admin.initializeApp();
                console.log('✅ Firebase Admin initialised (application default credentials)');
                isInitialized = true;
            } catch (defaultErr) {
                console.error('❌ Failed to initialize Firebase Admin:', defaultErr.message);
                throw defaultErr;
            }
        }
    }

    return admin;
}

module.exports = { initializeFirebase, admin };