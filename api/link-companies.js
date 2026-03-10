// api/link-companies.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database/syncline.db'));

db.serialize(() => {
    // Just link company_id — no role change (avoids CHECK constraint)
    db.run(
        `UPDATE users 
         SET company_id = (SELECT id FROM companies WHERE owner_id = users.id) 
         WHERE account_type = 'company' AND company_id IS NULL`,
        function(err) {
            if (err) {
                console.error('❌ Error:', err.message);
            } else {
                console.log('✅ Linked ' + this.changes + ' users to their companies');
            }

            // Verify result
            db.all('SELECT id, email, role, company_id, account_type FROM users', (err2, rows) => {
                console.log('\nCurrent users:');
                rows.forEach(r => {
                    console.log(`  ${r.email} | role: ${r.role} | company_id: ${r.company_id} | type: ${r.account_type}`);
                });
                db.close(() => console.log('\n✅ Done — restart server and log in again'));
            });
        }
    );
});