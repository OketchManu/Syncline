// api/fix-companies.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database/syncline.db'));

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // 1. Create companies table if missing
    db.run(`
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            owner_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ companies table:', err.message);
        else console.log('✅ companies table ready');
    });

    // 2. Add role 'owner' to users role check if not already valid
    // (SQLite doesn't enforce CHECK constraints on existing rows so this is safe)

    // 3. For any user with account_type = 'company' and no company_id,
    //    create a company and link them as owner
    db.all(
        `SELECT id, email, full_name FROM users WHERE account_type = 'company' AND company_id IS NULL`,
        (err, users) => {
            if (err) { console.error('❌ fetch users:', err.message); return; }

            if (users.length === 0) {
                console.log('ℹ️  No unlinked company accounts found');
                done();
                return;
            }

            let pending = users.length;
            users.forEach(user => {
                const companyName = `${user.full_name}'s Company`;
                db.run(
                    `INSERT INTO companies (name, owner_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                    [companyName, user.id],
                    function(err2) {
                        if (err2) { console.error(`❌ create company for ${user.email}:`, err2.message); }
                        else {
                            const companyId = this.lastID;
                            db.run(
                                `UPDATE users SET company_id = ?, role = 'owner' WHERE id = ?`,
                                [companyId, user.id],
                                (err3) => {
                                    if (err3) console.error(`❌ link user ${user.email}:`, err3.message);
                                    else console.log(`✅ Created company "${companyName}" → linked to ${user.email}`);
                                }
                            );
                        }
                        if (--pending === 0) done();
                    }
                );
            });
        }
    );
});

function done() {
    db.close(() => {
        console.log('\n🎉 Fix complete! Restart your server and log in again.');
    });
}