# worker/src/config/database.py
# SQLite database connection for the Python worker

import sqlite3
import os
from pathlib import Path

def get_db_path():
    """Get the database path, resolving relative to this file"""
    # Get the worker/src/config directory
    config_dir = Path(__file__).parent
    # Go up to worker/src, then worker, then syncline root, then into database
    db_path = config_dir / '..' / '..' / '..' / 'database' / 'syncline.db'
    return str(db_path.resolve())

def get_connection():
    """Create a database connection"""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at: {db_path}")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn

def test_connection():
    """Test if we can connect to the database"""
    try:
        conn = get_connection()
        db_path = get_db_path()
        print(f"✅ Database connected")
        print(f"✅ Connected to database: {db_path}")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def query(sql, params=()):
    """Execute a SELECT query and return all rows as dictionaries"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        # Convert sqlite3.Row objects to regular dictionaries
        return [dict(row) for row in rows]
    finally:
        conn.close()

def query_one(sql, params=()):
    """Execute a SELECT query and return a single row as a dictionary"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def execute(sql, params=()):
    """Execute an INSERT, UPDATE, or DELETE query"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()

def execute_many(sql, params_list):
    """Execute multiple INSERT, UPDATE, or DELETE queries in a batch"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.executemany(sql, params_list)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()