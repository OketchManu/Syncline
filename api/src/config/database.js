const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = path.join(__dirname, '../../../database/syncline.db');
const SCHEMA_PATH = path.join(__dirname, '../../../database/schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ Database directory created');
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database with schema
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Check if schema file exists
        if (!fs.existsSync(SCHEMA_PATH)) {
            console.warn('⚠️  Schema file not found. Please create database/schema.sql');
            resolve();
            return;
        }

        // Read schema file
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

        // Execute schema
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Error initializing database:', err.message);
                reject(err);
            } else {
                console.log('✅ Database initialized successfully');
                resolve();
            }
        });
    });
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Helper function to get single row
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to get multiple rows
function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Close database connection
function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                console.log('✅ Database connection closed');
                resolve();
            }
        });
    });
}

module.exports = {
    db,
    initializeDatabase,
    runQuery,
    getOne,
    getAll,
    closeDatabase
};