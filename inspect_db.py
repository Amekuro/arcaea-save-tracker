import sqlite3
import json

def inspect():
    db = sqlite3.connect('st3')
    db.row_factory = sqlite3.Row
    c = db.cursor()
    
    # Get tables
    c.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row['name'] for row in c.fetchall()]
    print(f"=== Tables ===\n{', '.join(tables)}\n")
    
    # Get schemas
    print("=== Schemas ===")
    for table in tables:
        print(f"[{table}]")
        c.execute(f"PRAGMA table_info('{table}');")
        for row in c.fetchall():
            print(f"  - {row['name']}: {row['type']}")
        print()
        
    # Peek at scores if exists
    if 'scores' in tables:
        print("=== Peek at scores table ===")
        c.execute("SELECT * FROM scores ORDER BY score DESC LIMIT 5")
        for row in c.fetchall():
            print(dict(row))
            
    # Peek at other interesting tables
    if 'clears' in tables:
        print("\n=== Peek at clears table ===")
        c.execute("SELECT * FROM clears LIMIT 3")
        for row in c.fetchall():
            print(dict(row))

if __name__ == '__main__':
    inspect()
