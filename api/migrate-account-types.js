// api/migrate-account-types.js - FIXED VERSION
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/syncline.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

db.run('PRAGMA foreign_keys = ON');

async function runMigration() {
    console.log('Starting migration fix...\n');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Step 1: Drop the existing companies table (it was created incorrectly)
            db.run(`DROP TABLE IF EXISTS companies`, (err) => {
                if (err) {
                    console.error('Error dropping companies table:', err.message);
                } else {
                    console.log('Dropped old companies table');
                }
            });

            // Step 2: Re-create companies table with correct column names
            db.run(`
                CREATE TABLE IF NOT EXISTS companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    owner_id INTEGER NOT NULL,
                    invite_code VARCHAR(20) UNIQUE,
                    industry VARCHAR(100),
                    size VARCHAR(50),
                    timezone VARCHAR(100) DEFAULT 'UTC',
                    logo_url VARCHAR(500),
                    website VARCHAR(500),
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating companies table:', err.message);
                } else {
                    console.log('Created companies table with correct columns');
                }
            });

            // Step 3: Verify users table has account_type
            db.run(`ALTER TABLE users ADD COLUMN account_type VARCHAR(20) DEFAULT 'individual'`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding account_type:', err.message);
                } else if (err) {
                    console.log('account_type column already exists');
                } else {
                    console.log('Added account_type column');
                }
            });

            // Step 4: Update existing users
            db.run(`UPDATE users SET account_type = 'individual' WHERE account_type IS NULL OR account_type = ''`, function(err) {
                if (err) {
                    console.error('Error updating users:', err.message);
                } else {
                    console.log(`Updated ${this.changes} users to 'individual'`);
                }
            });

            // Step 5: Verify company_id column exists
            db.run(`ALTER TABLE users ADD COLUMN company_id INTEGER NULL`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding company_id:', err.message);
                } else if (err) {
                    console.log('company_id column already exists');
                } else {
                    console.log('Added company_id column');
                }
            });

            // Step 6: Create indexes (now with correct column names)
            db.run(`CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type)`, (err) => {
                if (err) console.error('Error creating index:', err.message);
                else console.log('Created index on users.account_type');
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)`, (err) => {
                if (err) console.error('Error creating index:', err.message);
                else console.log('Created index on users.company_id');
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id)`, (err) => {
                if (err) console.error('Error creating index:', err.message);
                else console.log('Created index on companies.owner_id');
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_companies_invite_code ON companies(invite_code)`, (err) => {
                if (err) {
                    console.error('Error creating index:', err.message);
                } else {
                    console.log('Created index on companies.invite_code');
                }
                
                // Verify the fix
                console.log('\nVerifying migration...');
                
                db.all("PRAGMA table_info(companies)", (err, rows) => {
                    if (err) {
                        console.error('Verification error:', err.message);
                    } else {
                        console.log('\nCompanies table columns:');
                        rows.forEach(row => {
                            console.log(`  - ${row.name} (${row.type})`);
                        });
                    }
                    
                    // Close database
                    db.close((err) => {
                        if (err) {
                            console.error('Error closing database:', err.message);
                            reject(err);
                        } else {
                            console.log('\nDatabase connection closed');
                            console.log('Migration fix completed successfully!\n');
                            resolve();
                        }
                    });
                });
            });
        });
    });
}

runMigration()
    .then(() => {
        console.log('All done! You can now start your server.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });