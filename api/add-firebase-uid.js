// api/add-firebase-uid.js
// Run once: node add-firebase-uid.js
const path   = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'src', 'database.sqlite');
// ↑ adjust this path if your .sqlite file is somewhere else

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not open database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database:', DB_PATH);
});

db.serialize(() => {
    // Add firebase_uid column (safe — does nothing if column already exists)
    db.run(
        `ALTER TABLE users ADD COLUMN firebase_uid TEXT`,
        (err) => {
            if (err && err.message.includes('duplicate column')) {
                console.log('ℹ️  firebase_uid column already exists — skipping');
            } else if (err) {
                console.error('Migration error:', err.message);
            } else {
                console.log('✅ Added firebase_uid column to users table');
            }
        }
    );

    // Add index for fast lookups
    db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid
         ON users(firebase_uid)
         WHERE firebase_uid IS NOT NULL`,
        (err) => {
            if (err) console.error('Index error (non-fatal):', err.message);
            else console.log('✅ Index created on firebase_uid');
        }
    );

    db.close(() => {
        console.log('');
        console.log('✅ Migration complete. You can now start your server.');
    });
});