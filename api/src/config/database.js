// api/src/config/database.js
// UNIVERSAL DATABASE CONNECTOR - Works with SQLite (local) and PostgreSQL (production)

const path = require('path');
const fs = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
// DETERMINE DATABASE TYPE
// ══════════════════════════════════════════════════════════════════════════════
const DATABASE_URL = process.env.DATABASE_URL;
const isProduction = DATABASE_URL && DATABASE_URL.startsWith('postgres');

let db, runQuery, getOne, getAll;

if (isProduction) {
    // ══════════════════════════════════════════════════════════════════════════
    // POSTGRESQL (PRODUCTION - RENDER)
    // ══════════════════════════════════════════════════════════════════════════
    const { Pool } = require('pg');
    
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
        console.error('❌ PostgreSQL pool error:', err);
    });

    db = pool;

    // PostgreSQL uses $1, $2, $3 instead of ?
    function convertPlaceholders(sql, params) {
        let index = 0;
        const converted = sql.replace(/\?/g, () => `$${++index}`);
        return { sql: converted, params };
    }

    runQuery = async (sql, params = []) => {
        const { sql: pgSql, params: pgParams } = convertPlaceholders(sql, params);
        
        // Handle INSERT...RETURNING for getting lastID
        if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
            // Add RETURNING id if not already present
            let finalSql = pgSql;
            if (!pgSql.toUpperCase().includes('RETURNING')) {
                finalSql = pgSql + ' RETURNING id';
            }
            
            try {
                const result = await pool.query(finalSql, pgParams);
                return {
                    id: result.rows[0]?.id || null,
                    changes: result.rowCount || 0
                };
            } catch (err) {
                console.error('❌ runQuery error:', err.message, '\nSQL:', pgSql);
                throw err;
            }
        }
        
        // Handle UPDATE/DELETE
        try {
            const result = await pool.query(pgSql, pgParams);
            return {
                id: null,
                changes: result.rowCount || 0
            };
        } catch (err) {
            console.error('❌ runQuery error:', err.message, '\nSQL:', pgSql);
            throw err;
        }
    };

    getOne = async (sql, params = []) => {
        const { sql: pgSql, params: pgParams } = convertPlaceholders(sql, params);
        try {
            const result = await pool.query(pgSql, pgParams);
            return result.rows[0] || null;
        } catch (err) {
            console.error('❌ getOne error:', err.message, '\nSQL:', pgSql);
            throw err;
        }
    };

    getAll = async (sql, params = []) => {
        const { sql: pgSql, params: pgParams } = convertPlaceholders(sql, params);
        try {
            const result = await pool.query(pgSql, pgParams);
            return result.rows || [];
        } catch (err) {
            console.error('❌ getAll error:', err.message, '\nSQL:', pgSql);
            throw err;
        }
    };

    console.log('✅ Connected to PostgreSQL database');

} else {
    // ══════════════════════════════════════════════════════════════════════════
    // SQLITE (LOCAL DEVELOPMENT)
    // ══════════════════════════════════════════════════════════════════════════
    const sqlite3 = require('sqlite3').verbose();
    
    let DB_PATH;
    const repoDB = path.join(__dirname, '../../../database/syncline.db');
    const localDB = path.join(__dirname, '../../data/syncline.db');

    const repoDir = path.dirname(repoDB);
    try {
        if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
        fs.accessSync(repoDir, fs.constants.W_OK);
        DB_PATH = repoDB;
        console.log('📂 Database path (repo):', DB_PATH);
    } catch (_) {
        const localDir = path.dirname(localDB);
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        DB_PATH = localDB;
        console.log('📂 Database path (local):', DB_PATH);
    }

    const sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('❌ Error connecting to database:', err.message);
            process.exit(1);
        }
        console.log('✅ Connected to SQLite database');
    });

    sqliteDb.run('PRAGMA foreign_keys = OFF');
    sqliteDb.run('PRAGMA journal_mode = WAL');

    db = sqliteDb;

    runQuery = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) {
                    console.error('❌ runQuery error:', err.message, '\nSQL:', sql);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    };

    getOne = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ getOne error:', err.message, '\nSQL:', sql);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    };

    getAll = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ getAll error:', err.message, '\nSQL:', sql);
                    reject(err);
                } else {
                    resolve(Array.isArray(rows) ? rows : rows ? [rows] : []);
                }
            });
        });
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════════

async function initializeDatabase() {
    if (isProduction) {
        // PostgreSQL: Schema is created via migrations
        console.log('✅ PostgreSQL ready - schema will be created via migrations');
        return;
    } else {
        // SQLite: Create schema from file or minimal schema
        const SCHEMA_PATH = path.join(__dirname, '../../../database/schema.sql');
        
        if (fs.existsSync(SCHEMA_PATH)) {
            const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
            return new Promise((resolve) => {
                db.exec(schema, (err) => {
                    if (err) {
                        console.log('ℹ️  Schema note:', err.message);
                    } else {
                        console.log('✅ Database schema applied successfully');
                    }
                    resolve();
                });
            });
        } else {
            console.log('⚙️  Creating minimal schema...');
            return createMinimalSchema();
        }
    }
}

async function createMinimalSchema() {
    const minimal = `
        CREATE TABLE IF NOT EXISTS users (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
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
            created_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'} DEFAULT ${isProduction ? 'NOW()' : 'CURRENT_TIMESTAMP'},
            last_seen ${isProduction ? 'TIMESTAMP' : 'DATETIME'},
            updated_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'}
        );
        CREATE TABLE IF NOT EXISTS companies (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
            name TEXT NOT NULL,
            owner_id INTEGER,
            invite_code TEXT UNIQUE,
            industry TEXT,
            size TEXT,
            description TEXT,
            website TEXT,
            logo_url TEXT,
            created_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'} DEFAULT ${isProduction ? 'NOW()' : 'CURRENT_TIMESTAMP'},
            updated_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'}
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            created_by INTEGER,
            assignee_id INTEGER,
            company_id INTEGER,
            org_id INTEGER,
            deadline ${isProduction ? 'TIMESTAMP' : 'DATETIME'},
            flagged INTEGER DEFAULT 0,
            flag_reason TEXT,
            visibility TEXT DEFAULT 'personal',
            created_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'} DEFAULT ${isProduction ? 'NOW()' : 'CURRENT_TIMESTAMP'},
            updated_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'}
        );
        CREATE TABLE IF NOT EXISTS profile_data (
            firebase_uid TEXT PRIMARY KEY,
            full_name TEXT,
            avatar_url TEXT,
            updated_at ${isProduction ? 'TIMESTAMP' : 'DATETIME'} DEFAULT ${isProduction ? 'NOW()' : 'CURRENT_TIMESTAMP'}
        );
        CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
        CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
    `;

    if (isProduction) {
        await runQuery(minimal.split(';').filter(s => s.trim()).join(';'));
    } else {
        await new Promise((resolve) => {
            db.exec(minimal, (err) => {
                if (err) console.error('❌ Minimal schema error:', err.message);
                else console.log('✅ Minimal schema created successfully');
                resolve();
            });
        });
    }
}

function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (isProduction) {
            db.end().then(() => {
                console.log('✅ Database connection closed');
                resolve();
            }).catch(reject);
        } else {
            db.close((err) => {
                if (err) reject(err);
                else { console.log('✅ Database connection closed'); resolve(); }
            });
        }
    });
}

function getDatabase() {
    return db;
}

async function resetDatabaseIfStale() {
    return Promise.resolve();
}

async function ensureTaskSchema() {
    // This runs after migrations as a safety net
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
    isProduction,
};