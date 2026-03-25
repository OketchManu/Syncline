// api/add-firebase-uid.js
// Run from api/ folder: node add-firebase-uid.js
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();

// Script is at: api/add-firebase-uid.js
// __dirname  = C:\Users\Admin\Documents\syncline\api
// ..         = C:\Users\Admin\Documents\syncline  (project root)
// ../database/syncline.db = C:\Users\Admin\Documents\syncline\database\syncline.db
const DB_PATH = path.join(__dirname, '..', 'database', 'syncline.db');

console.log('Looking for database at:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('Could not open database:', err.message); process.exit(1); }
    console.log('✅ Connected to:', DB_PATH);
});

db.serialize(() => {
    db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, tables) => {
        if (err) { console.error('Cannot list tables:', err.message); return; }
        console.log('📋 Tables found:', tables.map(t => t.name).join(', ') || 'NONE');

        const hasUsers = tables.some(t => t.name === 'users');
        if (!hasUsers) {
            console.log('\n⚠️  users table not found. Start the server first then re-run.');
            db.close(); return;
        }

        db.all(`PRAGMA table_info(users)`, [], (err, cols) => {
            if (err) { console.error('PRAGMA error:', err.message); return; }
            const hasCol = cols.some(c => c.name === 'firebase_uid');
            if (hasCol) {
                console.log('✅ firebase_uid already exists — nothing to do.');
                db.close(); return;
            }

            db.run(`ALTER TABLE users ADD COLUMN firebase_uid TEXT`, (err) => {
                if (err) console.error('ALTER error:', err.message);
                else     console.log('✅ Added firebase_uid column');

                db.run(
                    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL`,
                    (err) => {
                        if (err) console.error('Index error:', err.message);
                        else     console.log('✅ Index created');
                        db.close(() => console.log('\n✅ Migration complete.'));
                    }
                );
            });
        });
    });
});