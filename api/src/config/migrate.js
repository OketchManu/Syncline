// api/src/config/migrate.js
const { runQuery, getAll, getDatabase } = require('./database');

// ─── Cleanup any orphaned users_old ──────────────────────────────────────────
// If a previous partial migration left users_old behind, drop it now.
async function cleanupOrphanedUsersOld() {
    const tables = await getAll(`SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'`);
    if (tables.length === 0) return;
    console.log('🧹 Found orphaned users_old table — cleaning up...');
    await runQuery(`DROP TABLE IF EXISTS users_old`);
    console.log('✅ users_old dropped');
}

// ─── Atomic users table rebuild ───────────────────────────────────────────────
// Rebuilds the users table to remove NOT NULL from password_hash.
// Dynamically reads which columns exist in users_old so it never references
// a column that hasn't been added yet.
async function rebuildUsersTableIfNeeded() {
    const tableInfo = await getAll(`PRAGMA table_info(users)`);
    if (tableInfo.length === 0) return; // table doesn't exist yet — migrations will create it

    const pwCol = tableInfo.find(c => c.name === 'password_hash');
    if (!pwCol || pwCol.notnull === 0) return; // already fixed — nothing to do

    console.log('🔧 Rebuilding users table to remove NOT NULL from password_hash...');

    // Full target column list for the new table
    const targetColumns = [
        { name: 'id',            def: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'email',         def: 'TEXT UNIQUE NOT NULL' },
        { name: 'password_hash', def: 'TEXT' },
        { name: 'full_name',     def: 'TEXT' },
        { name: 'account_type',  def: "TEXT DEFAULT 'personal'" },
        { name: 'role',          def: "TEXT DEFAULT 'member'" },
        { name: 'firebase_uid',  def: 'TEXT UNIQUE' },
        { name: 'avatar_url',    def: 'TEXT' },
        { name: 'company_id',    def: 'INTEGER' },
        { name: 'org_id',        def: 'INTEGER' },
        { name: 'is_active',     def: 'INTEGER DEFAULT 1' },
        { name: 'join_status',   def: "TEXT DEFAULT 'active'" },
        { name: 'last_seen',     def: 'DATETIME' },
        { name: 'updated_at',    def: 'DATETIME' },
        { name: 'created_at',    def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ];

    // Only copy columns that actually exist in users_old
    const existingColNames = tableInfo.map(c => c.name);
    const colsToCopy = targetColumns
        .filter(c => existingColNames.includes(c.name))
        .map(c => c.name);

    const colDefsSQL  = targetColumns.map(c => `${c.name} ${c.def}`).join(',\n                    ');
    const colListSQL  = colsToCopy.join(', ');

    const db = getDatabase();

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN', (err) => { if (err) return reject(err); });

            db.run(`ALTER TABLE users RENAME TO users_old`, (err) => {
                if (err) { db.run('ROLLBACK'); return reject(err); }
            });

            db.run(`CREATE TABLE users (\n                    ${colDefsSQL}\n                )`, (err) => {
                if (err) { db.run('ROLLBACK'); return reject(err); }
            });

            db.run(
                `INSERT INTO users (${colListSQL}) SELECT ${colListSQL} FROM users_old`,
                (err) => {
                    if (err) { db.run('ROLLBACK'); return reject(err); }
                }
            );

            db.run(`DROP TABLE IF EXISTS users_old`, (err) => {
                if (err) { db.run('ROLLBACK'); return reject(err); }
            });

            db.run('COMMIT', (err) => {
                if (err) { db.run('ROLLBACK'); return reject(err); }
                console.log('✅ Users table rebuilt successfully');
                resolve();
            });
        });
    });
}

// ─── Migrations list ──────────────────────────────────────────────────────────
const MIGRATIONS = [
    // ── Users ─────────────────────────────────────────────────────────────────
    { name: 'users — add account_type', sql: `ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'personal'` },
    { name: 'users — add role',         sql: `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'` },
    { name: 'users — add firebase_uid', sql: `ALTER TABLE users ADD COLUMN firebase_uid TEXT` },
    { name: 'users — add avatar_url',   sql: `ALTER TABLE users ADD COLUMN avatar_url TEXT` },
    { name: 'users — add company_id',   sql: `ALTER TABLE users ADD COLUMN company_id INTEGER` },
    { name: 'users — add org_id',       sql: `ALTER TABLE users ADD COLUMN org_id INTEGER` },
    { name: 'users — add is_active',    sql: `ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1` },
    { name: 'users — add join_status',  sql: `ALTER TABLE users ADD COLUMN join_status TEXT DEFAULT 'active'` },
    { name: 'users — add last_seen',    sql: `ALTER TABLE users ADD COLUMN last_seen DATETIME` },
    { name: 'users — add updated_at',   sql: `ALTER TABLE users ADD COLUMN updated_at DATETIME` },
    { name: 'users — add full_name',    sql: `ALTER TABLE users ADD COLUMN full_name TEXT` },

    // ── Tasks ─────────────────────────────────────────────────────────────────
    { name: 'tasks — add company_id',   sql: `ALTER TABLE tasks ADD COLUMN company_id INTEGER` },
    { name: 'tasks — add org_id',       sql: `ALTER TABLE tasks ADD COLUMN org_id INTEGER` },
    { name: 'tasks — add assignee_id',  sql: `ALTER TABLE tasks ADD COLUMN assignee_id INTEGER` },
    { name: 'tasks — add flagged',      sql: `ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0` },
    { name: 'tasks — add flag_reason',  sql: `ALTER TABLE tasks ADD COLUMN flag_reason TEXT` },
    { name: 'tasks — add deadline',     sql: `ALTER TABLE tasks ADD COLUMN deadline DATETIME` },
    { name: 'tasks — add updated_at',   sql: `ALTER TABLE tasks ADD COLUMN updated_at DATETIME` },
    { name: 'tasks — add visibility',   sql: `ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'personal'` },

    // ── System tables ─────────────────────────────────────────────────────────
    {
        name: 'create companies table',
        sql: `CREATE TABLE IF NOT EXISTS companies (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            owner_id    INTEGER,
            invite_code TEXT UNIQUE,
            industry    TEXT,
            size        TEXT,
            description TEXT,
            website     TEXT,
            logo_url    TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'create company_members table',
        sql: `CREATE TABLE IF NOT EXISTS company_members (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id    INTEGER NOT NULL,
            role       TEXT DEFAULT 'member',
            status     TEXT DEFAULT 'active',
            joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, user_id)
        )`,
    },
    {
        name: 'create join_requests table',
        sql: `CREATE TABLE IF NOT EXISTS join_requests (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id    INTEGER NOT NULL,
            status     TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, user_id)
        )`,
    },
    {
        name: 'create invitations table',
        sql: `CREATE TABLE IF NOT EXISTS invitations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id  INTEGER NOT NULL,
            email       TEXT NOT NULL,
            invited_by  INTEGER,
            invite_code TEXT UNIQUE,
            status      TEXT DEFAULT 'pending',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'create task_reports table',
        sql: `CREATE TABLE IF NOT EXISTS task_reports (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id      INTEGER NOT NULL,
            submitted_by INTEGER NOT NULL,
            company_id   INTEGER,
            report_text  TEXT,
            status       TEXT DEFAULT 'submitted',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },

    // ── Custom migrations ─────────────────────────────────────────────────────
    {
        name: 'tasks — ensure created_by column exists',
        custom: async () => {
            const cols = await getAll(`PRAGMA table_info(tasks)`);
            if (cols.some(c => c.name === 'created_by')) return;
            await runQuery(`ALTER TABLE tasks ADD COLUMN created_by INTEGER`);
        },
    },
    {
        name: 'fix localhost avatar/logo URLs',
        custom: async () => {
            await runQuery(`
                UPDATE users
                SET avatar_url = REPLACE(avatar_url, 'http://localhost:3001', 'https://syncline-1.onrender.com')
                WHERE avatar_url LIKE 'http://localhost:3001%'
            `).catch(() => {});
            await runQuery(`
                UPDATE companies
                SET logo_url = REPLACE(logo_url, 'http://localhost:3001', 'https://syncline-1.onrender.com')
                WHERE logo_url LIKE 'http://localhost:3001%'
            `).catch(() => {});
        },
    },
];

const INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_company_id   ON tasks(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_created_by   ON tasks(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON tasks(assignee_id)`,
];

// ─── Main entry point ─────────────────────────────────────────────────────────
async function runMigrations() {
    console.log('🔄 Running database migrations...');

    // Step 1: Drop any orphaned users_old left by a previous partial run
    await cleanupOrphanedUsersOld();

    // Step 2: Run all ALTER TABLE / CREATE TABLE migrations first
    //         so every column exists before the rebuild reads the schema
    let ran = 0, skipped = 0;

    for (const migration of MIGRATIONS) {
        try {
            if (migration.custom) {
                await migration.custom();
            } else {
                await runQuery(migration.sql);
            }
            ran++;
        } catch (err) {
            const msg = err.message.toLowerCase();
            if (
                msg.includes('duplicate column name') ||
                msg.includes('already exists') ||
                msg.includes('no such table')
            ) {
                skipped++;
            } else {
                console.warn(`⚠️  Migration warning [${migration.name}]: ${err.message}`);
            }
        }
    }

    // Step 3: NOW rebuild users table atomically if password_hash was NOT NULL.
    //         All columns are guaranteed to exist in users at this point.
    await rebuildUsersTableIfNeeded();

    // Step 4: Ensure indexes
    for (const sql of INDEXES) {
        await runQuery(sql).catch(() => {});
    }

    console.log(`✅ Migrations done: ${ran} applied, ${skipped} already current`);
}

module.exports = { runMigrations };