import psycopg2
from database_view import add_connected_database

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