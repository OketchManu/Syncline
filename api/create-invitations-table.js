// api/create-invitations-table.js
const { db } = require('./src/config/database');

console.log('📋 Creating team_invitations table...\n');

const createTableSQL = `
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
    used_at TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
)`;

db.run(createTableSQL, (err) => {
    if (err) {
        console.error('❌ Error creating table:', err.message);
        process.exit(1);
    } else {
        console.log('✅ team_invitations table created successfully');
        
        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_team_invitations_company ON team_invitations(company_id)', (err) => {
            if (!err) console.log('✅ Index created: idx_team_invitations_company');
        });
        
        db.run('CREATE INDEX IF NOT EXISTS idx_team_invitations_code ON team_invitations(invite_code)', (err) => {
            if (!err) console.log('✅ Index created: idx_team_invitations_code');
        });
        
        db.run('CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email)', (err) => {
            if (!err) console.log('✅ Index created: idx_team_invitations_email');
        });
    }
    
    setTimeout(() => {
        console.log('\n🎉 Done! Table ready. Restart your server.');
        db.close();
        process.exit(0);
    }, 500);
});