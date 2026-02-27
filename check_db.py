import sqlite3
conn = sqlite3.connect('database/syncline.db')
tables = conn.execute('SELECT name FROM sqlite_master WHERE type="table"').fetchall()
print("Tables in database:", tables)
conn.close()
