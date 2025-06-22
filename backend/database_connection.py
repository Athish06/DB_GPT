import psycopg2
from database_view import add_connected_database
from dotenv import dotenv_values
import os

env = dotenv_values(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

def connect_postgresql_from_json(db_config: dict):
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"],
            port=db_config.get("port", 5432)
        )
        print("Database connection successful.")
        # Send details to database_view
        db_info = {
            "database_name": db_config["database"],
            "host": db_config["host"],
            "user_name": db_config["user"],
            "port": db_config.get("port", 5432)
        }
        add_connected_database(db_info)
        print(db_info)
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def add_database_details(db_config: dict):
    """
    Adds a new database entry to the database_details table.
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
        cur.execute(
            "INSERT INTO database_details (database_name, name, host, user_name, password, port) VALUES (%s, %s, %s,%s, %s, %s)",
            (
                db_config["database"],
                db_config["name"],
                db_config["host"],
                db_config["user"],
                db_config["password"],
                db_config.get("port", 5432)
            )
        )
        conn.commit()
        cur.close()
        conn.close()
        # Optionally, add to connected databases in-memory
        db_info = {
            "database_name": db_config["database"],
            "host": db_config["host"],
            "user_name": db_config["user"],
            "port": db_config.get("port", 5432)
        }
        add_connected_database(db_info)
        return True, None
    except Exception as e:
        print(f"Error adding database: {e}")
        return False, str(e)