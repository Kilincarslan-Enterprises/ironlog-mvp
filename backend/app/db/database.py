import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("IRONLOG_DB", Path(__file__).parent.parent.parent / "ironlog.db"))

def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    schema = Path(__file__).with_name("schema.sql").read_text()
    conn.executescript(schema)
    conn.commit()
    conn.close()

def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}
