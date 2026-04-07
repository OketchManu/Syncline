// api/src/config/database.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

// ─── Resolve database path ────────────────────────────────────────────────────
let DB_PATH;
let SCHEMA_PATH;

const repoDB      = path.join(__dirname, '../../../database/syncline.db');
const repoSchema  = path.join(__dirname, '../../../database/schema.sql');
const localDB     = path.join(__dirname, '../../data/syncline.db');
const localSchema = path.join(__dirname, '../../data/schema.sql');

const repoDir = path.dirname(repoDB);
try {
    if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
    fs.accessSync(repoDir, fs.constants.W_OK);
    DB_PATH     = repoDB;
    SCHEMA_PATH = repoSchema;
    console.log('📂 Database path (repo):', DB_PATH);
} catch (_) {
    const localDir = path.dirname(localDB);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    DB_PATH     = localDB;
    SCHEMA_PATH = localSchema;
    console.log('📂 Database path (local):', DB_PATH);
}

if (DB_PATH === localDB && fs.existsSync(repoSchema) && !fs.existsSync(localSchema)) {
    fs.copyFileSync(repoSchema, localSchema);
}

// ─── Connect ──────────────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

db.run('PRAGMA foreign_keys = OFF'); // kept OFF until after migrations
db.run('PRAGMA journal_mode = WAL');

// ─── Low-level promise helpers ────────────────────────────────────────────────
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(Array.isArray(rows) ? rows : rows ? [rows] : []);
        });
    });
}

function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else { console.log('✅ Database connection closed'); resolve(); }
        });
    });
}

function getDatabase() { return db; }

// ─── Pre-schema cleanup ───────────────────────────────────────────────────────
// Runs BEFORE schema.sql is applied so that ghost tables/triggers from a
// previous broken migration can never survive into the new schema run.
async function preSchemaCleanup() {
    // 1. Drop any ghost triggers referencing shadow tables
    let triggers = [];
    try {
        triggers = await getAll(
            `SELECT name, sql FROM sqlite_master WHERE type = 'trigger'`
        );
    } catch (_) {}

    for (const t of triggers) {
        const sql = (t.sql || '').toLowerCase();
        if (
            sql.includes('users_old') || sql.includes('tasks_old') ||
            sql.includes('users_new') || sql.includes('tasks_new')
        ) {
            console.log(`🧹 Pre-schema: dropping ghost trigger: ${t.name}`);
            await runQuery(`DROP TRIGGER IF EXISTS "${t.name}"`).catch(() => {});
        }
    }

    // 2. Drop shadow / ghost tables
    // users_old is the root cause — schema.sql used to CREATE TABLE users_old
    // which then got referenced by ghost triggers on tasks.
    for (const tbl of ['users_old', 'users_new', 'tasks_old', 'tasks_new']) {
        await runQuery(`DROP TABLE IF EXISTS "${tbl}"`).catch(() => {});
    }
}

// ─── Initialize schema ────────────────────────────────────────────────────────
async function initializeDatabase() {
    // Always purge ghost tables/triggers before touching the schema.
    // This handles the case where a previous deploy left users_old behind.
    await preSchemaCleanup();

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(SCHEMA_PATH)) {
            console.warn('⚠️  Schema file not found at:', SCHEMA_PATH);
            createMinimalSchema(resolve, reject);
            return;
        }

        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.serialize(() => {
            db.exec(schema, (err) => {
                if (err) {
                    // Schema already partially applied is fine — not a hard error.
                    console.log('ℹ️  Schema note:', err.message);
                    resolve();
                } else {
                    console.log('✅ Database schema applied successfully');
                    resolve();
                }
            });
        });
    });
}

// ─── Minimal schema fallback ──────────────────────────────────────────────────
function createMinimalSchema(resolve, reject) {
    console.log('⚙️  Creating minimal schema...');
    const minimal = `
        CREATE TABLE IF NOT EXISTS users (
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
        );
        CREATE TABLE IF NOT EXISTS companies (
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
        );
        CREATE TABLE IF NOT EXISTS tasks (
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
        );
        CREATE TABLE IF NOT EXISTS company_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'member',
            status TEXT DEFAULT 'active',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS join_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(company_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS task_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            submitted_by INTEGER NOT NULL,
            company_id INTEGER,
            report_text TEXT,
            status TEXT DEFAULT 'submitted',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            invited_by INTEGER,
            invite_code TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS profile_data (
            firebase_uid TEXT PRIMARY KEY,
            full_name TEXT,
            avatar_url TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_by   ON tasks(created_by);
        CREATE INDEX IF NOT EXISTS idx_tasks_company_id   ON tasks(company_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON tasks(assignee_id);
    `;

    db.exec(minimal, (err) => {
        if (err) {
            console.error('❌ Minimal schema error:', err.message);
            reject(err);
        } else {
            console.log('✅ Minimal schema created successfully');
            resolve();
        }
    });
}

// ─── Belt-and-suspenders column heal ─────────────────────────────────────────
// Runs after migrations as a final safety net. Uses proper async/await
// so each ALTER TABLE completes before the next one starts.
async function ensureTaskSchema() {
    let rows = [];
    try {
        rows = await getAll(`PRAGMA table_info(tasks)`);
    } catch (err) {
        console.log('⚠️  Tasks table not ready for healing:', err.message);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('⚠️  Tasks table not ready for healing');
        return;
    }

    const columns = rows.map(r => r.name);
    const needed = [
        { name: 'visibility',  sql: `ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'personal'` },
        { name: 'flagged',     sql: `ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0` },
        { name: 'deadline',    sql: `ALTER TABLE tasks ADD COLUMN deadline DATETIME` },
        { name: 'company_id',  sql: `ALTER TABLE tasks ADD COLUMN company_id INTEGER` },
        { name: 'org_id',      sql: `ALTER TABLE tasks ADD COLUMN org_id INTEGER` },
        { name: 'assignee_id', sql: `ALTER TABLE tasks ADD COLUMN assignee_id INTEGER` },
        { name: 'created_by',  sql: `ALTER TABLE tasks ADD COLUMN created_by INTEGER` },
        { name: 'priority',    sql: `ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'` },
        { name: 'status',      sql: `ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'pending'` },
        { name: 'flag_reason', sql: `ALTER TABLE tasks ADD COLUMN flag_reason TEXT` },
        { name: 'updated_at',  sql: `ALTER TABLE tasks ADD COLUMN updated_at DATETIME` },
    ];

    for (const col of needed) {
        if (!columns.includes(col.name)) {
            try {
                await runQuery(col.sql);
                console.log(`🔧 Added missing column: tasks.${col.name}`);
            } catch (err) {
                if (!err.message.toLowerCase().includes('duplicate column')) {
                    console.error(`🔧 Heal failed for ${col.name}:`, err.message);
                }
            }
        }
    }
}

async function resetDatabaseIfStale() {
    return Promise.resolve();
}

module.exports = {
    db,
    getDatabase,
    initializeDatabase,
    resetDatabaseIfStale,
    ensureTaskSchema,
    runQuery,
    getOne,
    getAll,
    closeDatabase,
};