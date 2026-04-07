// api/migrate.js
// ─────────────────────────────────────────────────────────────────────────────
// LEGACY ENTRY POINT — kept only so any old scripts that require() this file
// don't break. All real migration logic now lives in:
//
//   api/src/config/migrate.js
//
// That file is what server.js calls. Do NOT add migration logic here.
// ─────────────────────────────────────────────────────────────────────────────

const { runMigrations } = require('./src/config/migrate');

module.exports = { runMigrations };

// Allow running directly: node api/migrate.js
if (require.main === module) {
    const { initializeDatabase } = require('./src/config/database');
    (async () => {
        try {
            await initializeDatabase();
            await runMigrations();
            console.log('✅ Migration complete');
            process.exit(0);
        } catch (err) {
            console.error('❌ Migration failed:', err);
            process.exit(1);
        }
    })();
}