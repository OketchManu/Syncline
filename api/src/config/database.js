// api/src/config/database.js
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

// ─── Resolve database path ────────────────────────────────────────────────────
// Works on local (../../../database/syncline.db) AND on Render (/opt/render/...)
// Strategy: try the repo-relative path first; fall back to a local data/ folder.

let DB_PATH;
let SCHEMA_PATH;

const repoDB     = path.join(__dirname, '../../../database/syncline.db');
const repoSchema = path.join(__dirname, '../../../database/schema.sql');
const localDB    = path.join(__dirname, '../../data/syncline.db');
const localSchema= path.join(__dirname, '../../data/schema.sql');

// Use repo path if the directory is writable, otherwise use local data/
const repoDir = path.dirname(repoDB);
try {
    fs.mkdirSync(repoDir, { recursive: true });
    fs.accessSync(repoDir, fs.constants.W_OK);
    DB_PATH     = repoDB;
    SCHEMA_PATH = repoSchema;
    console.log('📂 Database path (repo):', DB_PATH);
} catch (_) {
    // On Render the repo root may not be writable — use a local data folder
    fs.mkdirSync(path.dirname(localDB), { recursive: true });
    DB_PATH     = localDB;
    SCHEMA_PATH = localSchema;
    console.log('📂 Database path (local):', DB_PATH);
}

// Copy schema to local path if using fallback and schema exists in repo
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
db.run('PRAGMA journal_mode = WAL');  // better concurrent write performance

// ─── Initialize schema ────────────────────────────────────────────────────────
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(SCHEMA_PATH)) {
            console.warn('⚠️  Schema file not found at:', SCHEMA_PATH);
            // Create minimal tables inline so the app still works
            createMinimalSchema(resolve, reject);
            return;
        }

        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Error initializing database:', err.message);
                // Try minimal schema as fallback
                createMinimalSchema(resolve, reject);
            } else {
                console.log('✅ Database initialized successfully');
                resolve();
            }
        });
    });
}

// Minimal schema — runs if schema.sql is missing (e.g. first Render deploy)
function createMinimalSchema(resolve, reject) {
    console.log('⚙️  Creating minimal schema...');
    const minimal = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            full_name TEXT NOT NULL,
            account_type TEXT DEFAULT 'personal',
            role TEXT DEFAULT 'member',
            firebase_uid TEXT UNIQUE,
            avatar_url TEXT,
            company_id INTEGER,
            org_id INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS companies (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_reports (
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
        );

        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            email TEXT,
            role TEXT DEFAULT 'member',
            token TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
        CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) { console.error('❌ runQuery error:', err.message, '\nSQL:', sql); reject(err); }
            else      { resolve({ id: this.lastID, changes: this.changes }); }
        });
    });
}

function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) { console.error('❌ getOne error:', err.message, '\nSQL:', sql); reject(err); }
            else      { resolve(row || null); }
        });
    });
}

function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) { console.error('❌ getAll error:', err.message, '\nSQL:', sql); reject(err); }
            else      { resolve(Array.isArray(rows) ? rows : rows ? [rows] : []); }
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

// ─── Reset stale database ─────────────────────────────────────────────────────
// Deletes the DB file if it was created with the old broken schema (password_hash NOT NULL).
// Runs once on startup. Safe to run on every deploy.
async function resetDatabaseIfStale() {
    return new Promise((resolve) => {
        db.get(`PRAGMA table_info(users)`, [], (err, row) => {
            // If we can't read the schema, skip reset
            if (err) { resolve(); return; }
        });

        db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
            if (err || !rows) { resolve(); return; }

            const passwordCol = rows.find(r => r.name === 'password_hash');
            if (passwordCol && passwordCol.notnull === 1) {
                // Stale schema detected — delete the DB file and reconnect
                console.log('⚠️  Stale schema detected (password_hash NOT NULL). Resetting database...');
                db.close(() => {
                    fs.unlink(DB_PATH, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('❌ Could not delete stale DB:', unlinkErr.message);
                        } else {
                            console.log('✅ Stale database deleted. Fresh DB will be created.');
                        }
                        // Re-require to reconnect — easiest way to restart the module
                        console.log('🔄 Restarting process to reconnect to fresh DB...');
                        process.exit(0); // Render will auto-restart the service
                    });
                });
            } else {
                resolve(); // Schema is fine
            }
        });
    });
}

module.exports = { db, getDatabase, initializeDatabase, resetDatabaseIfStale, runQuery, getOne, getAll, closeDatabase }; 