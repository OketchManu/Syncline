// api/clean-database.js - Complete cleanup
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/syncline.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🧹 Database Cleanup Tool\n');

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Show what will be deleted
db.get('SELECT COUNT(*) as taskCount FROM tasks', (err, taskRow) => {
    const taskCount = taskRow ? taskRow.taskCount : 0;

    console.log('This will delete:');
    console.log(`  - ${taskCount} tasks`);
    console.log('');
    console.log('Users will NOT be deleted.\n');

    rl.question('Type "CLEAN" to proceed: ', (answer) => {
        if (answer === 'CLEAN') {
            console.log('\n🗑️  Deleting tasks...');

            db.serialize(() => {
                // Delete all tasks
                db.run('DELETE FROM tasks', function(err) {
                    if (err) {
                        console.error('❌ Error deleting tasks:', err.message);
                    } else {
                        console.log(`✅ Deleted ${this.changes} tasks`);
                    }
                });

                // Reset task ID counter
                db.run('DELETE FROM sqlite_sequence WHERE name="tasks"', (err) => {
                    if (!err) {
                        console.log('✅ Reset task ID counter');
                    }
                });

                // Also clean up any related tables (if they exist)
                db.run('DELETE FROM task_assignments', function(err) {
                    if (!err && this.changes > 0) {
                        console.log(`✅ Deleted ${this.changes} task assignments`);
                    }
                });

                db.run('DELETE FROM task_progress', function(err) {
                    if (!err && this.changes > 0) {
                        console.log(`✅ Deleted ${this.changes} progress entries`);
                    }
                });

                db.run('DELETE FROM task_reports', function(err) {
                    if (!err && this.changes > 0) {
                        console.log(`✅ Deleted ${this.changes} reports`);
                    }
                });

                // Verify
                db.get('SELECT COUNT(*) as count FROM tasks', (err, row) => {
                    console.log(`\n📊 Final task count: ${row ? row.count : 0}`);
                    
                    if (row && row.count === 0) {
                        console.log('✅ Database is now clean!');
                    }
                    
                    db.close();
                    rl.close();
                    console.log('\n🎉 Done! Restart your servers to see changes.\n');
                });
            });
        } else {
            console.log('\n❌ Cleanup cancelled');
            db.close();
            rl.close();
        }
    });
});