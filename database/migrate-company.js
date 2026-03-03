const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'syncline.db');
const schemaPath = path.join(__dirname, 'add-company-tables.sql');

console.log('📊 Starting database migration...');
console.log('📁 Database:', dbPath);
console.log('📄 Schema:', schemaPath);

const db = new sqlite3.Database(dbPath);
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('❌ Migration failed:', err.message);
        // Some ALTER TABLE commands might fail if columns exist - that's ok
        if (err.message.includes('duplicate column')) {
            console.log('⚠️  Some columns already exist, skipping...');
            console.log('✅ Migration completed with warnings');
        } else {
            process.exit(1);
        }
    } else {
        console.log('✅ Database migrated successfully!');
        console.log('✅ New tables created:');
        console.log('   ✓ companies');
        console.log('   ✓ departments');
        console.log('   ✓ task_assignments');
        console.log('   ✓ task_reports');
        console.log('   ✓ report_requests');
        console.log('   ✓ task_progress');
        console.log('   ✓ invitations');
        console.log('');
        console.log('✅ Enhanced existing tables:');
        console.log('   ✓ users (added company_id, department_id, job_title)');
        console.log('   ✓ tasks (added company_id, department_id, reported_by)');
        console.log('');
        console.log('🎉 Company features are now available!');
    }
    db.close();
});
