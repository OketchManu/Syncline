// api/migrate-multitenant.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/syncline.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🔄 Starting multi-tenant migration...\n');

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // Add company_id to tasks
    db.run(`ALTER TABLE tasks ADD COLUMN company_id INTEGER NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding company_id to tasks:', err.message);
        } else if (err) {
            console.log('ℹ️  tasks.company_id already exists');
        } else {
            console.log('✅ Added company_id to tasks');
        }
    });

    // Add visibility to tasks
    db.run(`ALTER TABLE tasks ADD COLUMN visibility VARCHAR(20) DEFAULT 'company'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding visibility:', err.message);
        } else if (err) {
            console.log('ℹ️  tasks.visibility already exists');
        } else {
            console.log('✅ Added visibility to tasks');
        }
    });

    // Create task_audit_log
    db.run(`
        CREATE TABLE IF NOT EXISTS task_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action VARCHAR(50) NOT NULL,
            field_changed VARCHAR(100),
            old_value TEXT,
            new_value TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45),
            user_agent TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err) console.error('❌ Error creating task_audit_log:', err.message);
        else console.log('✅ Created task_audit_log table');
    });

    // Create team_invitations
    db.run(`
        CREATE TABLE IF NOT EXISTS team_invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            email VARCHAR(255) NOT NULL,
            invite_code VARCHAR(20) UNIQUE NOT NULL,
            invited_by INTEGER NOT NULL,
            role VARCHAR(20) DEFAULT 'member',
            status VARCHAR(20) DEFAULT 'pending',
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('❌ Error creating team_invitations:', err.message);
        else console.log('✅ Created team_invitations table');
    });

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id)`, (err) => {
        if (err) console.error('❌ Error creating index:', err.message);
        else console.log('✅ Created index on tasks.company_id');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_task_id ON task_audit_log(task_id)`, (err) => {
        if (err) console.error('❌ Error creating index:', err.message);
        else console.log('✅ Created index on task_audit_log.task_id');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_company ON team_invitations(company_id)`, (err) => {
        if (err) console.error('❌ Error creating index:', err.message);
        else console.log('✅ Created index on team_invitations.company_id');
    });

    // Update existing tasks to link to user's company
    db.run(`
        UPDATE tasks 
        SET company_id = (
            SELECT company_id FROM users WHERE users.id = tasks.created_by
        )
        WHERE company_id IS NULL AND created_by IS NOT NULL
    `, function(err) {
        if (err) console.error('❌ Error linking tasks to companies:', err.message);
        else console.log(`✅ Linked ${this.changes} tasks to companies`);
        
        db.close((err) => {
            if (err) console.error('❌ Error closing database:', err.message);
            else {
                console.log('\n✅ Database connection closed');
                console.log('🎉 Multi-tenant migration completed!\n');
            }
        });
    });
});