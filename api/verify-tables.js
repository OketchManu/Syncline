// api/verify-tables.js
const { db } = require('./src/config/database');

console.log('🔍 Verifying database tables...\n');

const requiredTables = [
    'users',
    'companies',
    'team_invitations',
    'tasks'
];

requiredTables.forEach(table => {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
        if (err) {
            console.error(`❌ Error checking ${table}:`, err.message);
        } else if (row) {
            console.log(`✅ Table exists: ${table}`);
            
            // Show column info
            db.all(`PRAGMA table_info(${table})`, (err, cols) => {
                if (!err && cols) {
                    console.log(`   Columns: ${cols.map(c => c.name).join(', ')}`);
                }
            });
        } else {
            console.error(`❌ Table missing: ${table}`);
        }
    });
});

setTimeout(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
}, 1000);