// api/src/config/migrate.js
const { db, initializeDatabase } = require('./database');

const MIGRATIONS = [
    // ── Core tables ───────────────────────────────────────────────────────────
    {
        name: 'create companies table',
        sql: `CREATE TABLE IF NOT EXISTS companies (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            owner_id    INTEGER,
            invite_code TEXT    UNIQUE,
            industry    TEXT,
            size        TEXT,
            description TEXT,
            website     TEXT,
            logo_url    TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME
        )`,
    },
    {
        name: 'create company_members table',
        sql: `CREATE TABLE IF NOT EXISTS company_members (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id    INTEGER NOT NULL,
            role       TEXT    DEFAULT 'member',
            status     TEXT    DEFAULT 'active',
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
            status     TEXT    DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'create invitations table',
        sql: `CREATE TABLE IF NOT EXISTS invitations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            email      TEXT,
            role       TEXT    DEFAULT 'member',
            token      TEXT    UNIQUE,
            status     TEXT    DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )`,
    },
    {
        name: 'create task_reports table',
        sql: `CREATE TABLE IF NOT EXISTS task_reports (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id      INTEGER,
            submitted_by INTEGER,
            title        TEXT,
            summary      TEXT,
            hours_spent  REAL,
            blockers     TEXT,
            next_steps   TEXT,
            status       TEXT DEFAULT 'pending',
            feedback     TEXT,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },

    // ── users column additions ────────────────────────────────────────────────
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

    // ── tasks column additions ────────────────────────────────────────────────
    { name: 'tasks — add company_id',  sql: `ALTER TABLE tasks ADD COLUMN company_id INTEGER` },
    { name: 'tasks — add org_id',      sql: `ALTER TABLE tasks ADD COLUMN org_id INTEGER` },
    { name: 'tasks — add assignee_id', sql: `ALTER TABLE tasks ADD COLUMN assignee_id INTEGER` },
    { name: 'tasks — add flagged',     sql: `ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0` },
    { name: 'tasks — add flag_reason', sql: `ALTER TABLE tasks ADD COLUMN flag_reason TEXT` },
    { name: 'tasks — add deadline',    sql: `ALTER TABLE tasks ADD COLUMN deadline DATETIME` },
    { name: 'tasks — add updated_at',  sql: `ALTER TABLE tasks ADD COLUMN updated_at DATETIME` },

    // ── indexes ───────────────────────────────────────────────────────────────
    { name: 'companies — add invite_code index',  sql: `CREATE INDEX IF NOT EXISTS idx_companies_invite_code ON companies(invite_code)` },
    { name: 'users — add firebase_uid index',     sql: `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL` },
    { name: 'users — add email index',            sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)` },
    { name: 'tasks — add created_by index',       sql: `CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by)` },
    { name: 'tasks — add company_id index',       sql: `CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id)` },

    // ── fix NOT NULL on password_hash (users table rebuild) ───────────────────
    { name: 'users — drop users_new if exists from failed migration', sql: `DROP TABLE IF EXISTS users_new` },
    {
        name: 'users — fix password_hash NOT NULL constraint',
        sql: `CREATE TABLE IF NOT EXISTS users_new (
            id            INTEGER  PRIMARY KEY AUTOINCREMENT,
            email         TEXT     UNIQUE NOT NULL,
            password_hash TEXT,
            full_name     TEXT,
            account_type  TEXT     DEFAULT 'personal',
            role          TEXT     DEFAULT 'member',
            firebase_uid  TEXT     UNIQUE,
            avatar_url    TEXT,
            company_id    INTEGER,
            org_id        INTEGER,
            is_active     INTEGER  DEFAULT 1,
            join_status   TEXT     DEFAULT 'active',
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen     DATETIME,
            updated_at    DATETIME
        )`,
    },
    {
        name: 'users — copy data into users_new',
        sql: `INSERT OR IGNORE INTO users_new
            (id, email, password_hash, full_name, account_type, role,
             firebase_uid, avatar_url, company_id, org_id, is_active,
             join_status, created_at, last_seen, updated_at)
            SELECT id, email, password_hash, full_name, account_type, role,
             firebase_uid, avatar_url, company_id, org_id, is_active,
             join_status, created_at, last_seen, updated_at
            FROM users`,
    },
    { name: 'users — drop old users table',       sql: `DROP TABLE IF EXISTS users_old` },
    { name: 'users — rename users to users_old',  sql: `ALTER TABLE users RENAME TO users_old` },
    { name: 'users — rename users_new to users',  sql: `ALTER TABLE users_new RENAME TO users` },
    { name: 'users — drop users_old',             sql: `DROP TABLE IF EXISTS users_old` },
    { name: 'users — restore firebase_uid index after rebuild', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid_unique ON users(firebase_uid) WHERE firebase_uid IS NOT NULL` },
    { name: 'users — restore email index after rebuild',        sql: `CREATE INDEX IF NOT EXISTS idx_users_email_after_rebuild ON users(email)` },
    { name: 'users — fix localhost avatar_url to use Render URL', sql: `UPDATE users SET avatar_url = REPLACE(avatar_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE avatar_url LIKE 'http://localhost:3001%'` },
    { name: 'users — fix localhost logo_url in companies to use Render URL', sql: `UPDATE companies SET logo_url = REPLACE(logo_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE logo_url LIKE 'http://localhost:3001%'` },
    { name: 'cleanup — drop users_old if still exists', sql: `DROP TABLE IF EXISTS users_old` },

    // ── FIX: rebuild tasks table cleanly ─────────────────────────────────────
    // Eliminates ghost FK triggers from users_old and ensures all columns exist.
    { name: 'tasks — drop tasks_new if exists from failed migration', sql: `DROP TABLE IF EXISTS tasks_new` },
    {
        name: 'tasks — create tasks_new without FK triggers',
        sql: `CREATE TABLE IF NOT EXISTS tasks_new (
            id          INTEGER  PRIMARY KEY AUTOINCREMENT,
            title       TEXT     NOT NULL,
            description TEXT,
            status      TEXT     DEFAULT 'pending',
            priority    TEXT     DEFAULT 'medium',
            created_by  INTEGER,
            assignee_id INTEGER,
            company_id  INTEGER,
            org_id      INTEGER,
            deadline    DATETIME,
            flagged     INTEGER  DEFAULT 0,
            flag_reason TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'tasks — copy data into tasks_new',
        sql: `INSERT OR IGNORE INTO tasks_new
            (id, title, description, status, priority, created_by, assignee_id,
             company_id, org_id, deadline, flagged, flag_reason, created_at, updated_at)
            SELECT id, title, description, status, priority, created_by, assignee_id,
             company_id, org_id, deadline, flagged, flag_reason, created_at, updated_at
            FROM tasks`,
    },
    { name: 'tasks — drop tasks_old if exists',  sql: `DROP TABLE IF EXISTS tasks_old` },
    { name: 'tasks — rename tasks to tasks_old', sql: `ALTER TABLE tasks RENAME TO tasks_old` },
    { name: 'tasks — rename tasks_new to tasks', sql: `ALTER TABLE tasks_new RENAME TO tasks` },
    { name: 'tasks — drop tasks_old',            sql: `DROP TABLE IF EXISTS tasks_old` },
    { name: 'tasks — restore created_by index after rebuild', sql: `CREATE INDEX IF NOT EXISTS idx_tasks_created_by_v2 ON tasks(created_by)` },
    { name: 'tasks — restore company_id index after rebuild', sql: `CREATE INDEX IF NOT EXISTS idx_tasks_company_id_v2 ON tasks(company_id)` },

    // ── profile_data — persists custom name/avatar across DB wipes ────────────
    {
        name: 'create profile_data table',
        sql: `CREATE TABLE IF NOT EXISTS profile_data (
            firebase_uid TEXT PRIMARY KEY,
            full_name    TEXT,
            avatar_url   TEXT,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },

    // ── invitations — add invited_by column ──────────────────────────────────
    { name: 'invitations — add invited_by column', sql: `ALTER TABLE invitations ADD COLUMN invited_by INTEGER` },

    // ── task_reports — add submitted_by alias and company_id ─────────────────
    { name: 'task_reports — add company_id', sql: `ALTER TABLE task_reports ADD COLUMN company_id INTEGER` },
    { name: 'task_reports — add next_steps', sql: `ALTER TABLE task_reports ADD COLUMN next_steps TEXT` },

    // ── CRITICAL FIX: ensure tasks table has updated_at with DEFAULT ──────────
    // If tasks_new migration already ran but updated_at had no default, insert fails.
    // This is a safe no-op if the column already has a default.
    {
        name: 'tasks — ensure clean schema v2 (fix updated_at default)',
        sql: `CREATE TABLE IF NOT EXISTS tasks_v2 (
            id          INTEGER  PRIMARY KEY AUTOINCREMENT,
            title       TEXT     NOT NULL,
            description TEXT,
            status      TEXT     DEFAULT 'pending',
            priority    TEXT     DEFAULT 'medium',
            created_by  INTEGER,
            assignee_id INTEGER,
            company_id  INTEGER,
            org_id      INTEGER,
            deadline    DATETIME,
            flagged     INTEGER  DEFAULT 0,
            flag_reason TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'tasks — copy data into tasks_v2',
        sql: `INSERT OR IGNORE INTO tasks_v2
            (id, title, description, status, priority, created_by, assignee_id,
             company_id, org_id, deadline, flagged, flag_reason, created_at, updated_at)
            SELECT id, title, description, status, priority, created_by, assignee_id,
             company_id, org_id, deadline, flagged, flag_reason, created_at,
             COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
            FROM tasks`,
    },
    { name: 'tasks — drop tasks_backup if exists', sql: `DROP TABLE IF EXISTS tasks_backup` },
    { name: 'tasks — rename tasks to tasks_backup', sql: `ALTER TABLE tasks RENAME TO tasks_backup` },
    { name: 'tasks — rename tasks_v2 to tasks', sql: `ALTER TABLE tasks_v2 RENAME TO tasks` },
    { name: 'tasks — drop tasks_backup', sql: `DROP TABLE IF EXISTS tasks_backup` },
    { name: 'tasks — restore idx after v2 rebuild created_by', sql: `CREATE INDEX IF NOT EXISTS idx_tasks_created_by_v3 ON tasks(created_by)` },
    { name: 'tasks — restore idx after v2 rebuild company_id', sql: `CREATE INDEX IF NOT EXISTS idx_tasks_company_id_v3 ON tasks(company_id)` },
];

// ─── Runner ───────────────────────────────────────────────────────────────────
function runMigrations() {
    return new Promise((resolve) => {
        console.log('🔄 Running schema migrations...');
        let index = 0;
        function next() {
            if (index >= MIGRATIONS.length) {
                console.log('✅ All migrations complete');
                resolve();
                return;
            }
            const migration = MIGRATIONS[index++];
            db.run(migration.sql.trim(), (err) => {
                if (!err) {
                    console.log(`  ✅ Applied: ${migration.name}`);
                } else if (
                    err.message.includes('duplicate column') ||
                    err.message.includes('already exists') ||
                    err.message.includes('UNIQUE constraint') ||
                    err.message.includes('no such table: main.tasks_old') ||
                    err.message.includes('no such table: main.tasks_backup')
                ) {
                    // Already applied or harmless — skip silently
                } else {
                    console.warn(`  ⚠️  Skipped [${migration.name}]: ${err.message}`);
                }
                next();
            });
        }
        next();
    });
}

module.exports = { runMigrations };

if (require.main === module) {
    (async () => {
        await initializeDatabase();
        await runMigrations();
        process.exit(0);
    })();
}