const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./syncline.db');

console.log('🔍 Diagnosing database...\n');

// Check tasks
db.all("SELECT COUNT(*) as count FROM tasks", (err, result) => {
    if (err) {
        console.error('❌ Error reading tasks:', err.message);
    } else {
        console.log('📋 Tasks in database:', result[0].count);
        
        // Show first few tasks
        db.all("SELECT id, title, status, created_by FROM tasks LIMIT 5", (err, tasks) => {
            if (tasks && tasks.length > 0) {
                console.log('   Sample tasks:');
                tasks.forEach(t => console.log(`   - ${t.id}: ${t.title} (${t.status})`));
            }
        });
    }
});

// Check users
db.all("SELECT id, email, full_name, avatar, company_id FROM users", (err, users) => {
    if (err) {
        console.error('❌ Error reading users:', err.message);
    } else {
        console.log('\n👥 Users in database:', users.length);
        users.forEach(u => {
            console.log(`   - ${u.email}`);
            console.log(`     Name: ${u.full_name}`);
            console.log(`     Avatar: ${u.avatar || 'None'}`);
            console.log(`     Company: ${u.company_id || 'None'}`);
        });
    }
});

// Check table structure
setTimeout(() => {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        console.log('\n📊 Users table columns:');
        columns.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    });
    
    db.all("PRAGMA table_info(tasks)", (err, columns) => {
        console.log('\n📊 Tasks table columns:');
        columns.forEach(c => console.log(`   - ${c.name} (${c.type})`));
        
        setTimeout(() => db.close(), 500);
    });
}, 1000);
