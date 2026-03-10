// api/fix-join-status.js
// Run once: node fix-join-status.js
// Adds join_status column to users, adds invite_code to companies,
// creates join_requests table, and back-fills existing company members.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('crypto');

async function run() {
    const { db } = require('./src/config/database');

    // Give DB a moment to connect
    await new Promise(r => setTimeout(r, 500));

    console.log('--- Syncline join_status migration ---');

    // 1. Add join_status to users
    try {
        await db.run(`ALTER TABLE users ADD COLUMN join_status TEXT`);
        console.log('✅ Added join_status column to users');
    } catch (_) {
        console.log('ℹ️  join_status column already exists');
    }

    // 2. Add invite_code to companies
    try {
        await db.run(`ALTER TABLE companies ADD COLUMN invite_code TEXT`);
        console.log('✅ Added invite_code column to companies');
    } catch (_) {
        console.log('ℹ️  invite_code column already exists');
    }

    // 3. Create join_requests table
    await db.run(`
        CREATE TABLE IF NOT EXISTS join_requests (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id   INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','accepted','declined')),
            requested_at TEXT NOT NULL DEFAULT (datetime('now')),
            resolved_at  TEXT,
            resolved_by  INTEGER,
            UNIQUE(company_id, user_id)
        )
    `);
    console.log('✅ join_requests table ready');

    // 4. Back-fill join_status for existing company members (treat as accepted)
    const result = await db.run(
        `UPDATE users SET join_status = 'accepted'
         WHERE company_id IS NOT NULL AND join_status IS NULL`
    );
    console.log(`✅ Back-filled join_status='accepted' for ${result.changes} existing members`);

    // 5. Generate invite codes for companies that don't have one
    const companies = await db.all('SELECT id, name FROM companies WHERE invite_code IS NULL');
    for (const c of companies) {
        const prefix = (c.name || 'SYNC').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
        let code, exists;
        do {
            code   = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            exists = await db.get('SELECT id FROM companies WHERE invite_code = ?', [code]);
        } while (exists);
        await db.run('UPDATE companies SET invite_code = ? WHERE id = ?', [code, c.id]);
        console.log(`✅ Generated invite code ${code} for company "${c.name}"`);
    }

    // 6. Show final state
    const users     = await db.all('SELECT id, email, account_type, company_id, join_status FROM users');
    const comps     = await db.all('SELECT id, name, invite_code FROM companies');
    console.log('\n--- Users ---');
    console.table(users);
    console.log('\n--- Companies ---');
    console.table(comps);

    console.log('\n✅ Migration complete. Restart the server.');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });