import psycopg2
import os
from dotenv import dotenv_values

# Load .env variables
env = dotenv_values(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# In-memory store for connected databases (for current server session)
connected_databases = []

def add_connected_database(db_info):
    """
    Add a connected database to the in-memory list if not already present.
    """
    for db in connected_databases:
        if db["database_name"] == db_info["database_name"] and db["user_name"] == db_info["user_name"]:
            return
    connected_databases.append(db_info)

def get_postgresql_databases():
    """
    Returns a list of database details from the 'database_details' table,
    but only those that are present in the connected_databases list.
    """
    try:
        conn = psycopg2.connect(
            host=env["DB_HOST"],
            database=env["DB_NAME"],
            user=env["DB_USER"],
            password=env["DB_PASSWORD"].strip("'"),
            port=env.get("DB_PORT", 5432)
        )
        cur = conn.cursor()
        cur.execute("SELECT database_name, host, user_name, port FROM database_details;")
        rows = cur.fetchall()
        # Only include databases that are in connected_databases
        databases = []
        for row in rows:
            db_row = {
                "database_name": row[0],
                "host": row[1],
                "user_name": row[2],
                "port": row[3]
            }
            for connected in connected_databases:
                if (db_row["database_name"] == connected["database_name"] and
                    db_row["user_name"] == connected["user_name"]):
                    databases.append(db_row)
                    print(db_row)
                    break
        cur.close()
        conn.close()
        return databases
    except Exception as e:
        print(f"Error fetching databases: {e}")
        return []

def clear_connected_databases():
    """
    Clears the in-memory list of connected databases.
    """
    global connected_databases
    connected_databases.clear()