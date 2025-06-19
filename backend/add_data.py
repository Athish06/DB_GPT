from flask import Blueprint, request, jsonify
import psycopg2


def new_data(db_config, table_name, row_data):
    """
    Inserts a new row into the specified table.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    if not db_config or not table_name or not row_data:
        return False, "Missing required fields"

    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"]
        )
        cur = conn.cursor()
        columns = ', '.join(row_data.keys())
        placeholders = ', '.join(['%s'] * len(row_data))
        values = list(row_data.values())
        sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
        cur.execute(sql, values)
        conn.commit()
        cur.close()
        conn.close()
        return True, None
    except Exception as e:
        print(f"Error inserting data: {e}")
        return False, str(e)