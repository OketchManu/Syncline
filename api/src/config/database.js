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

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// ─── Initialize schema ────────────────────────────────────────────────────────
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(SCHEMA_PATH)) {
            console.warn('⚠️  Schema file not found, creating minimal...');
            return createMinimalSchema(resolve, reject);
        }

        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        
        // Use serialize to ensure tables are created before returning
        db.serialize(() => {
            db.exec(schema, (err) => {
                if (err) {
                    console.log('ℹ️  Note: Schema tables might already exist.');
                    resolve();
                } else {
                    console.log('✅ Database schema applied successfully');
                    resolve();
                }
            });
        });
    });
}

function createMinimalSchema(resolve, reject) {
    const minimal = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            full_name TEXT,
            account_type TEXT DEFAULT 'personal',
            role TEXT DEFAULT 'member',
            firebase_uid TEXT UNIQUE,
            avatar_url TEXT,
            company_id INTEGER,
            org_id INTEGER,
            is_active INTEGER DEFAULT 1,
            join_status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME,
            updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            created_by INTEGER,
            assignee_id INTEGER,
            company_id INTEGER,
            org_id INTEGER,
            deadline DATETIME,
            flagged INTEGER DEFAULT 0,
            flag_reason TEXT,
            visibility TEXT DEFAULT 'personal',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        );
    `;
    db.exec(minimal, (err) => err ? reject(err) : resolve());
}

// ─── Schema Healing (Ensures all columns exist) ───────────────────────────────
async function ensureTaskSchema() {
    return new Promise((resolve) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'", (err, row) => {
            if (err || !row) {
                console.error('❌ Schema Heal: tasks table not found.');
                return resolve();
            }

            db.all(`PRAGMA table_info(tasks)`, (err, rows) => {
                if (err || !rows) return resolve();
                const columns = rows.map(r => r.name);
                const needed = [
                    { name: 'visibility', sql: "ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'personal'" },
                    { name: 'flagged',    sql: "ALTER TABLE tasks ADD COLUMN flagged INTEGER DEFAULT 0" },
                    { name: 'flag_reason',sql: "ALTER TABLE tasks ADD COLUMN flag_reason TEXT" },
                    { name: 'deadline',   sql: "ALTER TABLE tasks ADD COLUMN deadline DATETIME" },
                    { name: 'updated_at', sql: "ALTER TABLE tasks ADD COLUMN updated_at DATETIME" },
                    { name: 'assignee_id',sql: "ALTER TABLE tasks ADD COLUMN assignee_id INTEGER" },
                    { name: 'company_id', sql: "ALTER TABLE tasks ADD COLUMN company_id INTEGER" },
                    { name: 'org_id',     sql: "ALTER TABLE tasks ADD COLUMN org_id INTEGER" }
                ];

                const updates = needed.filter(c => !columns.includes(c.name));
                if (updates.length === 0) return resolve();

                db.serialize(async () => {
                    for (const col of updates) {
                        try {
                            await runQuery(col.sql);
                            console.log(`🔧 Added missing column: ${col.name}`);
                        } catch (e) {
                            // Silent catch for duplicate column errors
                        }
                    }
                    resolve();
                });
            });
        });
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

module.exports = {
    db,
    initializeDatabase,
    ensureTaskSchema,
    runQuery,
    getOne: (sql, p) => new Promise((res, rej) => db.get(sql, p, (err, r) => err ? rej(err) : res(r))),
    getAll: (sql, p) => new Promise((res, rej) => db.all(sql, p, (err, r) => err ? rej(err) : res(r)))
};