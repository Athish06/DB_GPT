import psycopg2

def connect_postgresql_from_json(db_config: dict):
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"]
        )
        print("Database connection successful.")
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None