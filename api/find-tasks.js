// api/find-tasks.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/syncline.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🔍 Searching for tasks...\n');

// Check if tasks table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'", (err, row) => {
    if (!row) {
        console.log('❌ No tasks table found in database');
        db.close();
        return;
    }

    console.log('✅ Tasks table exists\n');

    // Count total tasks
    db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
        console.log(`📊 Total tasks: ${row.count}\n`);

        if (row.count === 0) {
            console.log('✅ Database is clean - no tasks found');
            db.close();
            return;
        }

        // Show sample tasks
        console.log('📋 Sample tasks:\n');
        db.all('SELECT id, title, status, priority, created_by, assignee_id FROM tasks LIMIT 10', (err, tasks) => {
            tasks.forEach(task => {
                console.log(`  ID ${task.id}: "${task.title}"`);
                console.log(`    Status: ${task.status} | Priority: ${task.priority}`);
                console.log(`    Created by: ${task.created_by} | Assigned to: ${task.assignee_id}`);
                console.log('');
            });

            // Show user info
            console.log('\n👥 Users in database:\n');
            db.all('SELECT id, email, full_name FROM users', (err, users) => {
                users.forEach(user => {
                    console.log(`  ID ${user.id}: ${user.full_name || 'No name'} (${user.email})`);
                });

                db.close();
                console.log('\n---\n');
                console.log('To delete all tasks, run: node delete-all-tasks.js');
            });
        });
    });
});