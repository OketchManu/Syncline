-- Syncline Database Schema
-- SQLite compatible with PostgreSQL migration path

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member' CHECK(role IN ('admin', 'manager', 'member')),
    is_active BOOLEAN DEFAULT 1,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table (with versioning for conflict detection)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    assignee_id INTEGER,
    created_by INTEGER NOT NULL,
    deadline TIMESTAMP,
    flagged BOOLEAN DEFAULT 0,
    flag_reason TEXT,
    version INTEGER DEFAULT 1,  -- For optimistic locking and sync conflict detection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity log (for real-time feed)
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,  -- 'created_task', 'updated_task', 'completed_task', etc.
    entity_type VARCHAR(50) NOT NULL,  -- 'task', 'user', etc.
    entity_id INTEGER NOT NULL,
    details TEXT,  -- JSON string with additional info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'deadline_missed', 'task_assigned', 'task_completed', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    task_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Sync conflicts table (for offline sync resolution)
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    client_version INTEGER NOT NULL,
    server_version INTEGER NOT NULL,
    client_data TEXT NOT NULL,  -- JSON string with client's version of data
    resolved BOOLEAN DEFAULT 0,
    resolution TEXT,  -- 'server_wins', 'client_wins', 'merged'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments table (optional but useful)
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_flagged ON tasks(flagged);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);

-- Triggers to auto-update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_comments_timestamp 
AFTER UPDATE ON comments
BEGIN
    UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to increment version on task update (for conflict detection)
CREATE TRIGGER IF NOT EXISTS increment_task_version 
AFTER UPDATE ON tasks
WHEN OLD.version = NEW.version  -- Only increment if version wasn't manually changed
BEGIN
    UPDATE tasks SET version = version + 1 WHERE id = NEW.id;
END;

-- Insert default admin user (password: 'admin123')
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role) 
VALUES (1, 'admin@syncline.local', '$2b$12$PJOLbks10V4oXv28lMJ7NOF1YludXE48S9TtzWMZDZyeR3NXl22d2', 'Admin User', 'admin');

-- Insert sample data for testing (password: 'password123')
INSERT OR IGNORE INTO users (email, password_hash, full_name, role) 
VALUES 
    ('manager@syncline.local', '$2b$12$zDWZ61gHkgSXKYaqtxyL9.Anon3hBsfvpUUyBCVSizv/gVdOpVovi', 'Manager User', 'manager'),
    ('member@syncline.local', '$2b$12$zDWZ61gHkgSXKYaqtxyL9.Anon3hBsfvpUUyBCVSizv/gVdOpVovi', 'Team Member', 'member');

INSERT OR IGNORE INTO tasks (title, description, status, priority, assignee_id, created_by, deadline) 
VALUES 
    ('Setup development environment', 'Install all necessary tools and dependencies', 'completed', 'high', 3, 1, datetime('now', '+7 days')),
    ('Design database schema', 'Create tables and relationships', 'in_progress', 'high', 2, 1, datetime('now', '+3 days')),
    ('Implement user authentication', 'JWT-based auth system', 'pending', 'high', 3, 1, datetime('now', '+5 days')),
    ('Create task management API', 'REST endpoints for CRUD operations', 'pending', 'medium', 3, 2, datetime('now', '+10 days')),
    ('Build real-time WebSocket server', 'Live updates for all connected clients', 'pending', 'medium', 3, 2, datetime('now', '+14 days'));

-- Insert sample activities
INSERT OR IGNORE INTO activities (user_id, action, entity_type, entity_id, details)
VALUES
    (1, 'created_task', 'task', 1, '{"task_title": "Setup development environment"}'),
    (1, 'created_task', 'task', 2, '{"task_title": "Design database schema"}'),
    (3, 'updated_task', 'task', 1, '{"status": "completed"}');