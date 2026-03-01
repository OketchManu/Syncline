// api/src/config/migrate.js
// Run once to add avatar_url to the users table:
//   node api/src/config/migrate.js

require('dotenv').config();
const { initializeDatabase, runQuery } = require('./database');

async function migrate() {
    console.log('Running migrations...');
    await initializeDatabase();

    try {
        await runQuery(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL`);
        console.log('✅  Added avatar_url column to users table');
    } catch (err) {
        if (err.message && err.message.includes('duplicate column')) {
            console.log('ℹ️  avatar_url column already exists — skipping');
        } else {
            console.error('Migration error:', err.message);
            process.exit(1);
        }
    }

    console.log('✅  Migration complete');
    process.exit(0);
}

migrate();