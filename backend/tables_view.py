import psycopg2
from flask import Blueprint, request, jsonify

tables_bp = Blueprint('tables', __name__)

def get_postgresql_tables(db_config: dict):
    """
    Returns a list of table names in the connected PostgreSQL database.
    Args:
        db_config (dict): Database connection info.
    Returns:
        list: List of table names, or empty list if error.
    """
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"]
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE';
        """)
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        return tables
    except Exception as e:
        print(f"Error fetching tables: {e}")
        return []

def get_postgresql_table_data(db_config: dict, table_name: str):
    """
    Returns all data from the specified table in the PostgreSQL database.
    Args:
        db_config (dict): Database connection info.
        table_name (str): Name of the table to fetch data from.
    Returns:
        list: List of dictionaries containing row data, or empty list if error.
    """
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"]
        )
        cur = conn.cursor()
        print(table_name)
        database = db_config.get("database", "postgres")
        print(database)
        cur.execute(f"SELECT * FROM {table_name};")
        rows = cur.fetchall()
        colnames = [desc[0] for desc in cur.description]
        # Get column types and nullability
        cur.execute(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s
        """, (table_name,))
        schema = [
            {
                "name": col[0],
                "type": col[1],
                "nullable": col[2] == "YES"
            }
            for col in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return {
            "schema": schema,
            "rows": [dict(zip(colnames, row)) for row in rows]
        }
    except Exception as e:
        print(f"Error fetching table data: {e}")
        return {
            "schema": [],
            "rows": []
        }

