// api/migrate.js
const { db, initializeDatabase } = require('./database');

/**
 * Helper to check if a table exists before running migrations that depend on it
 */
function tableExists(tableName) {
    return new Promise((resolve) => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
            resolve(!!row);
        });
    });
}

const MIGRATIONS = [
    {
        name: 'create companies table',
        sql: `CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_id INTEGER,
            invite_code TEXT UNIQUE,
            industry TEXT,
            size TEXT,
            description TEXT,
            website TEXT,
            logo_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        )`
    },
    {
        name: 'create company_members table',
        sql: `CREATE TABLE IF NOT EXISTS company_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'member',
            status TEXT DEFAULT 'active',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, user_id)
        )`
    },
    {
        name: 'create join_requests table',
        sql: `CREATE TABLE IF NOT EXISTS join_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'create invitations table',
        sql: `CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            email TEXT,
            role TEXT DEFAULT 'member',
            token TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            invited_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )`
    },
    {
        name: 'create task_reports table',
        sql: `CREATE TABLE IF NOT EXISTS task_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            submitted_by INTEGER,
            title TEXT,
            summary TEXT,
            hours_spent REAL,
            blockers TEXT,
            next_steps TEXT,
            status TEXT DEFAULT 'pending',
            feedback TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    },

    // ── Individual Column Additions (Idempotent via Error Handling) ─────────────
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

    { name: 'tasks — add company_id',   sql: `ALTER TABLE tasks ADD COLUMN company_id INTEGER` },
    { name: 'tasks — add org_id',       sql: `ALTER TABLE tasks ADD COLUMN org_id INTEGER` },
    { name: 'tasks — add assignee_id',  sql: `ALTER TABLE tasks ADD COLUMN assignee_id INTEGER` },
    { name: 'tasks — add flagged',      sql: `ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0` },
    { name: 'tasks — add flag_reason',  sql: `ALTER TABLE tasks ADD COLUMN flag_reason TEXT` },
    { name: 'tasks — add deadline',     sql: `ALTER TABLE tasks ADD COLUMN deadline DATETIME` },
    { name: 'tasks — add updated_at',   sql: `ALTER TABLE tasks ADD COLUMN updated_at DATETIME` },

    // ── Indexes ────────────────────────────────────────────────────────────────
    { name: 'companies — add invite_code index',  sql: `CREATE INDEX IF NOT EXISTS idx_companies_invite_code ON companies(invite_code)` },
    { name: 'users — add firebase_uid index',     sql: `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL` },
    { name: 'users — add email index',            sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)` },
    { name: 'tasks — add created_by index',       sql: `CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by)` },
    { name: 'tasks — add company_id index',       sql: `CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id)` },

    // ── Table Rebuilds (Safe Logic) ────────────────────────────────────────────
    { name: 'cleanup — users_new', sql: `DROP TABLE IF EXISTS users_new` },
    {
        name: 'users — create new table schema',
        sql: `CREATE TABLE users_new (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            full_name     TEXT,
            account_type  TEXT DEFAULT 'personal',
            role          TEXT DEFAULT 'member',
            firebase_uid  TEXT UNIQUE,
            avatar_url    TEXT,
            company_id    INTEGER,
            org_id        INTEGER,
            is_active     INTEGER DEFAULT 1,
            join_status   TEXT DEFAULT 'active',
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen     DATETIME,
            updated_at    DATETIME
        )`
    },
    {
        name: 'users — copy and rebuild',
        sql: `INSERT OR IGNORE INTO users_new 
              SELECT id, email, password_hash, full_name, account_type, role, 
                     firebase_uid, avatar_url, company_id, org_id, is_active, 
                     join_status, created_at, last_seen, updated_at 
              FROM users`
    },
    { name: 'users — drop old backup', sql: `DROP TABLE IF EXISTS users_old` },
    { name: 'users — rename current to old', sql: `ALTER TABLE users RENAME TO users_old` },
    { name: 'users — rename new to current', sql: `ALTER TABLE users_new RENAME TO users` },
    { name: 'users — delete old backup', sql: `DROP TABLE IF EXISTS users_old` },

    // ── Tasks Rebuild (to resolve the users_old ghost reference) ───────────────
    { name: 'cleanup — tasks_new', sql: `DROP TABLE IF EXISTS tasks_new` },
    {
        name: 'tasks — create new table schema',
        sql: `CREATE TABLE tasks_new (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            description TEXT,
            status      TEXT DEFAULT 'pending',
            priority    TEXT DEFAULT 'medium',
            created_by  INTEGER,
            assignee_id INTEGER,
            company_id  INTEGER,
            org_id      INTEGER,
            deadline    DATETIME,
            flagged     INTEGER DEFAULT 0,
            flag_reason TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME
        )`
    },
    {
        name: 'tasks — copy data',
        sql: `INSERT OR IGNORE INTO tasks_new 
              SELECT id, title, description, status, priority, created_by, assignee_id, 
                     company_id, org_id, deadline, flagged, flag_reason, created_at, updated_at 
              FROM tasks`
    },
    { name: 'tasks — drop old backup', sql: `DROP TABLE IF EXISTS tasks_old` },
    { name: 'tasks — rename current to old', sql: `ALTER TABLE tasks RENAME TO tasks_old` },
    { name: 'tasks — rename new to current', sql: `ALTER TABLE tasks_new RENAME TO tasks` },
    { name: 'tasks — delete old backup', sql: `DROP TABLE IF EXISTS tasks_old` },

    // ── Maintenance & Meta ─────────────────────────────────────────────────────
    { name: 'create profile_data', sql: `CREATE TABLE IF NOT EXISTS profile_data (firebase_uid TEXT PRIMARY KEY, full_name TEXT, avatar_url TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)` },
    { name: 'fix localhost URLs — users', sql: `UPDATE users SET avatar_url = REPLACE(avatar_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE avatar_url LIKE 'http://localhost:3001%'` },
    { name: 'fix localhost URLs — companies', sql: `UPDATE companies SET logo_url = REPLACE(logo_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE logo_url LIKE 'http://localhost:3001%'` },
    { name: 'cleanup orphaned tasks', sql: `UPDATE tasks SET created_by = NULL WHERE created_by NOT IN (SELECT id FROM users)` }
];

async function runMigrations() {
    console.log('🔄 Running database schema migrations...');

    // 1. Recover from broken state if 'users' is missing but 'users_old' exists
    const hasUsers = await tableExists('users');
    const hasOldUsers = await tableExists('users_old');
    if (!hasUsers && hasOldUsers) {
        console.warn('⚠️  Detected broken state (users missing, users_old exists). Restoring...');
        await new Promise((r) => db.run(`ALTER TABLE users_old RENAME TO users`, r));
    }

    // 2. Disable Foreign Keys during migration to prevent ghost triggers
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = OFF');

        for (const m of MIGRATIONS) {
            db.run(m.sql, (err) => {
                if (err) {
                    if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
                        // Expected if columns/indexes already exist
                        return;
                    }
                    console.error(`  ❌ Error in [${m.name}]:`, err.message);
                } else {
                    console.log(`  ✅ Applied: ${m.name}`);
                }
            });
        }

        db.run('PRAGMA foreign_keys = ON', () => {
            console.log('✅ All migrations complete');
        });
    });
}

module.exports = { runMigrations };

if (require.main === module) {
    (async () => {
        await initializeDatabase();
        await runMigrations();
    })();
}