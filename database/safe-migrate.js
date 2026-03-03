const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./syncline.db');

console.log('📊 Running safe migration...\n');

// Helper to check if column exists
function columnExists(table, column, callback) {
    db.all(`PRAGMA table_info(${table})`, (err, columns) => {
        if (err) return callback(err);
        callback(null, columns.some(c => c.name === column));
    });
}

// Step 1: Create companies table
db.run(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT,
    logo TEXT,
    website TEXT,
    subscription_plan TEXT DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error('Companies table:', err.message);
    else console.log('✅ Companies table ready');
    
    // Step 2: Create departments table
    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        manager_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (manager_id) REFERENCES users(id)
    )`, (err) => {
        if (err) console.error('Departments table:', err.message);
        else console.log('✅ Departments table ready');
        
        // Step 3: Create task_assignments
        db.run(`CREATE TABLE IF NOT EXISTS task_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'contributor',
            assigned_by INTEGER NOT NULL,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(task_id, user_id)
        )`, (err) => {
            if (err) console.error('Task assignments:', err.message);
            else console.log('✅ Task assignments table ready');
            
            // Step 4: Create task_reports
            db.run(`CREATE TABLE IF NOT EXISTS task_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                submitted_by INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                status TEXT DEFAULT 'pending',
                hours_spent REAL,
                challenges TEXT,
                outcomes TEXT,
                reviewed_by INTEGER,
                reviewed_at DATETIME,
                review_notes TEXT,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id),
                FOREIGN KEY (submitted_by) REFERENCES users(id)
            )`, (err) => {
                if (err) console.error('Task reports:', err.message);
                else console.log('✅ Task reports table ready');
                
                // Step 5: Create report_requests
                db.run(`CREATE TABLE IF NOT EXISTS report_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    requested_from INTEGER NOT NULL,
                    requested_by INTEGER NOT NULL,
                    message TEXT,
                    due_date DATETIME,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES tasks(id),
                    FOREIGN KEY (requested_from) REFERENCES users(id),
                    FOREIGN KEY (requested_by) REFERENCES users(id)
                )`, (err) => {
                    if (err) console.error('Report requests:', err.message);
                    else console.log('✅ Report requests table ready');
                    
                    // Step 6: Create task_progress
                    db.run(`CREATE TABLE IF NOT EXISTS task_progress (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        progress_percent INTEGER DEFAULT 0,
                        status_update TEXT,
                        hours_worked REAL,
                        blockers TEXT,
                        next_steps TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (task_id) REFERENCES tasks(id),
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )`, (err) => {
                        if (err) console.error('Task progress:', err.message);
                        else console.log('✅ Task progress table ready');
                        
                        // Step 7: Create invitations
                        db.run(`CREATE TABLE IF NOT EXISTS invitations (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            company_id INTEGER NOT NULL,
                            email TEXT NOT NULL,
                            role TEXT DEFAULT 'member',
                            invited_by INTEGER NOT NULL,
                            token TEXT UNIQUE NOT NULL,
                            expires_at DATETIME NOT NULL,
                            accepted_at DATETIME,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (company_id) REFERENCES companies(id),
                            FOREIGN KEY (invited_by) REFERENCES users(id)
                        )`, (err) => {
                            if (err) console.error('Invitations:', err.message);
                            else console.log('✅ Invitations table ready');
                            
                            console.log('\n🎉 All company tables are ready!');
                            console.log('📝 Note: Column additions to users/tasks may have been skipped if they already exist.');
                            db.close();
                        });
                    });
                });
            });
        });
    });
});
