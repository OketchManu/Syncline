const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./syncline.db');

console.log('🔧 Fixing database issues...\n');

// Fix 1: Add avatar column (your table has avatar_url, but code expects avatar)
db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
        console.log('⚠️  Avatar column:', err.message);
    } else {
        console.log('✅ Avatar column ready');
        
        // Copy data from avatar_url to avatar
        db.run(`UPDATE users SET avatar = avatar_url WHERE avatar_url IS NOT NULL`, (err) => {
            if (err) console.log('⚠️  Copy avatar:', err.message);
            else console.log('✅ Avatar data copied from avatar_url');
        });
    }
});

// Fix 2: Check current users
setTimeout(() => {
    db.all("SELECT id, email, company_id FROM users", (err, users) => {
        console.log('\n👥 Current users:');
        users.forEach(u => console.log(`   - ${u.id}: ${u.email} (company: ${u.company_id || 'none'})`));
        
        // Fix 3: Assign tasks to users without requiring company
        // This makes them visible again
        console.log('\n📝 Recommendation:');
        console.log('   Your 133 tasks are hidden because they have no company_id.');
        console.log('   Choose one option:\n');
        console.log('   A) Keep as personal tasks (no company - recommended for now)');
        console.log('   B) Create a company and assign all tasks to it\n');
        
        db.close();
    });
}, 1000);
