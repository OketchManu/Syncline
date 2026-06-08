// api/src/config/migrate.js
// Runs on every server start via runMigrations() called in server.js.
// All operations are idempotent — safe to run multiple times.
//
// FIX SUMMARY:
// 1. Ghost triggers (referencing users_old/tasks_old) are dropped FIRST
//    before any INSERT on tasks can fire them.
// 2. Shadow tables (users_old, users_new, tasks_old, tasks_new) are
//    dropped FIRST so the rebuild steps start clean.
// 3. Table-rebuild SQL is REMOVED from the MIGRATIONS array — rebuilds
//    are handled by rebuildUsersIfNeeded() / rebuildTasksIfNeeded() which
//    use an atomic new→swap→drop pattern and check preconditions.
// 4. The old api/migrate.js (root-level) is superseded by this file.
//    Do NOT require() the old file anywhere.

const { runQuery, getAll } = require('./database');

// ─── Phase 1: Kill ghost triggers ────────────────────────────────────────────
// MUST run before any INSERT on tasks, otherwise SQLite fires the ghost
// trigger and crashes with "no such table: main.users_old".
async function dropGhostTriggers() {
    let triggers = [];
    try {
        triggers = await getAll(
            `SELECT name, sql FROM sqlite_master WHERE type = 'trigger'`
        );
    } catch (_) { return; }

    for (const trigger of triggers) {
        const sql = (trigger.sql || '').toLowerCase();
        if (
            sql.includes('users_old') ||
            sql.includes('tasks_old') ||
            sql.includes('users_new') ||
            sql.includes('tasks_new')
        ) {
            console.log(`🧹 Dropping ghost trigger: ${trigger.name}`);
            await runQuery(`DROP TRIGGER IF EXISTS "${trigger.name}"`).catch(e =>
                console.warn(`  ⚠️  Could not drop trigger ${trigger.name}: ${e.message}`)
            );
        }
    }
}

// ─── Phase 2: Drop orphaned shadow tables ────────────────────────────────────
// If a previous rebuild crashed mid-flight these linger and confuse
// subsequent steps.
async function dropShadowTables() {
    for (const tbl of ['users_old', 'users_new', 'tasks_old', 'tasks_new']) {
        await runQuery(`DROP TABLE IF EXISTS "${tbl}"`).catch(() => {});
    }
}

// ─── Phase 3: Rebuild users table if password_hash is NOT NULL ───────────────
// Uses users_new → swap pattern so `users` is NEVER absent during rebuild.
async function rebuildUsersIfNeeded() {
    let cols = [];
    try { cols = await getAll(`PRAGMA table_info(users)`); } catch (_) { return; }
    if (cols.length === 0) return; // table doesn't exist yet — database.js handles creation

    const pwCol = cols.find(c => c.name === 'password_hash');
    if (!pwCol || pwCol.notnull === 0) return; // already nullable, nothing to do

    console.log('🔧 Rebuilding users table — removing NOT NULL from password_hash...');

    // Defensive: drop new table if a previous attempt left it
    await runQuery(`DROP TABLE IF EXISTS users_new`).catch(() => {});

    await runQuery(`
        CREATE TABLE users_new (
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
        )
    `);

    await runQuery(`
        INSERT OR IGNORE INTO users_new
            (id, email, password_hash, full_name, account_type, role,
             firebase_uid, avatar_url, company_id, org_id, is_active,
             join_status, created_at, last_seen, updated_at)
        SELECT id, email, password_hash, full_name, account_type, role,
               firebase_uid, avatar_url, company_id, org_id, is_active,
               join_status, created_at, last_seen, updated_at
        FROM users
    `);

    // Atomic swap — users is absent for the minimum possible time
    await runQuery(`ALTER TABLE users RENAME TO users_old`);
    await runQuery(`ALTER TABLE users_new RENAME TO users`);
    await runQuery(`DROP TABLE IF EXISTS users_old`);

    console.log('✅ users table rebuilt — password_hash is now nullable');
}

// ─── Phase 4: Rebuild tasks table ────────────────────────────────────────────
// Clears any ghost FK trigger baked into the table definition and ensures
// all required columns (visibility, created_by) are present.
// Uses tasks_new → swap pattern preserving ALL existing task data.
async function rebuildTasksIfNeeded() {
    let cols = [];
    try { cols = await getAll(`PRAGMA table_info(tasks)`); } catch (_) { return; }
    if (cols.length === 0) return;

    // Check if any trigger on tasks still references a shadow table
    let triggers = [];
    try {
        triggers = await getAll(
            `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='tasks'`
        );
    } catch (_) {}

    const hasGhostTrigger = triggers.some(t => {
        const s = (t.sql || '').toLowerCase();
        return (
            s.includes('users_old') || s.includes('tasks_old') ||
            s.includes('users_new') || s.includes('tasks_new')
        );
    });

    const colNames          = cols.map(c => c.name);
    const missingCreatedBy  = !colNames.includes('created_by');
    const missingVisibility = !colNames.includes('visibility');

    if (!hasGhostTrigger && !missingCreatedBy && !missingVisibility) return; // nothing to do

    console.log('🔧 Rebuilding tasks table (clearing ghost triggers / adding missing columns)...');

    await runQuery(`DROP TABLE IF EXISTS tasks_new`).catch(() => {});

    await runQuery(`
        CREATE TABLE tasks_new (
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
            visibility  TEXT DEFAULT 'personal',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME
        )
    `);

    // Only copy columns that actually exist in the current tasks table
    const targetCols = [
        'id','title','description','status','priority','created_by',
        'assignee_id','company_id','org_id','deadline','flagged',
        'flag_reason','created_at','updated_at',
    ];
    const copyable = targetCols.filter(c => colNames.includes(c));

    if (copyable.length > 0) {
        await runQuery(`
            INSERT OR IGNORE INTO tasks_new (${copyable.join(', ')})
            SELECT ${copyable.join(', ')} FROM tasks
        `);
    }

    await runQuery(`ALTER TABLE tasks RENAME TO tasks_old`);
    await runQuery(`ALTER TABLE tasks_new RENAME TO tasks`);
    await runQuery(`DROP TABLE IF EXISTS tasks_old`);

    console.log('✅ tasks table rebuilt — ghost triggers cleared, all columns present');
}

// ─── Standard ALTER TABLE / CREATE TABLE migrations ──────────────────────────
// IMPORTANT: Do NOT include any table-rebuild steps here (renaming users →
// users_old etc.). Those belong only in rebuildUsersIfNeeded() above.
// Including them here caused the users_old ghost-trigger bug because the
// rename ran before dropGhostTriggers() could clean up.
const MIGRATIONS = [
    // ── Users columns ──────────────────────────────────────────────────────────
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

    // ── Tasks columns ──────────────────────────────────────────────────────────
    { name: 'tasks — add company_id',   sql: `ALTER TABLE tasks ADD COLUMN company_id INTEGER` },
    { name: 'tasks — add org_id',       sql: `ALTER TABLE tasks ADD COLUMN org_id INTEGER` },
    { name: 'tasks — add assignee_id',  sql: `ALTER TABLE tasks ADD COLUMN assignee_id INTEGER` },
    { name: 'tasks — add flagged',      sql: `ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0` },
    { name: 'tasks — add flag_reason',  sql: `ALTER TABLE tasks ADD COLUMN flag_reason TEXT` },
    { name: 'tasks — add deadline',     sql: `ALTER TABLE tasks ADD COLUMN deadline DATETIME` },
    { name: 'tasks — add updated_at',   sql: `ALTER TABLE tasks ADD COLUMN updated_at DATETIME` },
    { name: 'tasks — add visibility',   sql: `ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'personal'` },
    { name: 'tasks — add created_by',   sql: `ALTER TABLE tasks ADD COLUMN created_by INTEGER` },

    // ── System tables (all idempotent via CREATE TABLE IF NOT EXISTS) ──────────
    {
        name: 'create companies',
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
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME
        )`,
    },
    {
        name: 'create company_members',
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
        name: 'create join_requests',
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
        name: 'create invitations',
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
        name: 'create task_reports',
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
    {
        name: 'create profile_data',
        sql: `CREATE TABLE IF NOT EXISTS profile_data (
            firebase_uid TEXT PRIMARY KEY,
            full_name    TEXT,
            avatar_url   TEXT,
            account_type TEXT DEFAULT 'personal',
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    },
    {
        name: 'profile_data — add account_type',
        sql: `ALTER TABLE profile_data ADD COLUMN account_type TEXT DEFAULT 'personal'`,
    },
    {
        name: 'fix company account_type drift',
        custom: async () => {
            await runQuery(
                `UPDATE users SET account_type = 'company'
                 WHERE company_id IS NOT NULL AND account_type != 'company'`
            ).catch(() => {});
        },
    },

    // ── Data fixes ─────────────────────────────────────────────────────────────
    {
        name: 'fix localhost avatar/logo URLs',
        custom: async () => {
            await runQuery(
                `UPDATE users SET avatar_url = REPLACE(avatar_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE avatar_url LIKE 'http://localhost:3001%'`
            ).catch(() => {});
            await runQuery(
                `UPDATE companies SET logo_url = REPLACE(logo_url, 'http://localhost:3001', 'https://syncline-1.onrender.com') WHERE logo_url LIKE 'http://localhost:3001%'`
            ).catch(() => {});
        },
    },
    {
        name: 'cleanup orphaned tasks',
        custom: async () => {
            // Null out created_by for tasks whose creator no longer exists
            await runQuery(
                `UPDATE tasks SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM users)`
            ).catch(() => {});
        },
    },
];

const INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_created_by   ON tasks(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_company_id   ON tasks(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON tasks(assignee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_company_members_c  ON company_members(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_company_members_u  ON company_members(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_companies_invite   ON companies(invite_code)`,
];

// ─── Main entry point ─────────────────────────────────────────────────────────
async function runMigrations() {
    console.log('🔄 Running database migrations...');

    // ── Step A: Kill ghost triggers FIRST ────────────────────────────────────
    // This MUST happen before any INSERT on tasks. SQLite fires triggers even
    // when the tables they reference no longer exist, crashing with
    // "no such table: main.users_old".
    await dropGhostTriggers();

    // ── Step B: Drop shadow tables left over from previous crashed rebuilds ──
    await dropShadowTables();

    // ── Step C: Standard ALTER TABLE / CREATE TABLE migrations ───────────────
    let ran = 0, skipped = 0;
    for (const m of MIGRATIONS) {
        try {
            if (m.custom) { await m.custom(); }
            else          { await runQuery(m.sql); }
            ran++;
        } catch (err) {
            const msg = err.message.toLowerCase();
            if (
                msg.includes('duplicate column') ||
                msg.includes('already exists') ||
                msg.includes('no such table')
            ) {
                skipped++;
            } else {
                console.warn(`⚠️  [${m.name}]: ${err.message}`);
            }
        }
    }

    // ── Step D: Rebuild users if password_hash is still NOT NULL ─────────────
    await rebuildUsersIfNeeded();

    // ── Step E: Rebuild tasks if ghost trigger or missing columns detected ────
    await rebuildTasksIfNeeded();

    // ── Step F: Final ghost-trigger sweep (catches anything created by D/E) ──
    await dropGhostTriggers();
    await dropShadowTables();

    // ── Step G: Indexes (all idempotent) ─────────────────────────────────────
    for (const sql of INDEXES) {
        await runQuery(sql).catch(() => {});
    }

    console.log(`✅ Migrations done: ${ran} applied, ${skipped} already current`);
}

module.exports = { runMigrations };