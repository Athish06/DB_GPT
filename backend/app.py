from flask import Flask, request, jsonify
from flask_cors import CORS
from database_connection import connect_postgresql_from_json
from tables_view import get_postgresql_tables, get_postgresql_table_data 
from gemini import generate_dml_proposal 
from add_data import new_data
from auth import login_api
from database_view import get_postgresql_databases, clear_connected_databases

app = Flask(__name__)
CORS(app, supports_credentials=True)

@app.route('/connect_db', methods=['POST'])
def connect_db():
    db_config = request.get_json()
    conn = connect_postgresql_from_json(db_config)
    if conn:
        conn.close()
        return jsonify({"status": "success", "message": "Database connection successful."}), 200
    else:
        return jsonify({"status": "error", "message": "Database connection failed."}), 400

@app.route('/tables', methods=['POST'])
def view_tables():
    """
    Expects JSON with db_config.
    Returns list of table names.
    """
    db_config = request.get_json()
    tables = get_postgresql_tables(db_config)
    return jsonify({"tables": tables})

@app.route('/table/<table_name>', methods=['POST'])
def view_table_data(table_name):
    """
    Expects JSON with db_config.
    Returns all data from the specified table.
    """
    db_config = request.get_json()
    data = get_postgresql_table_data(db_config, table_name)
    return jsonify(data)


@app.route('/ai/generate-dml', methods=['POST'])
def ai_generate_dml():
    data = request.get_json()
    user_request = data.get("user_request")
    schema_info = data.get("schema_info")
    db_type = data.get("db_type", "PostgreSQL")
    if not user_request or not schema_info:
        return jsonify({"error": "Missing user_request or schema_info"}), 400
    dml = generate_dml_proposal(user_request, schema_info, db_type)
    if dml:
        return jsonify({"dml": dml})
    else:
        return jsonify({"error": "Failed to generate DML"}), 500

@app.route('/add_data', methods=['POST'])
def add_data_api():
    data = request.get_json()
    db_config = data.get('db_config')
    table_name = data.get('table_name')
    row_data = data.get('data')
    success, error = new_data(db_config, table_name, row_data)
    if success:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"success": False, "error": error}), 500

@app.route('/login', methods=['POST'])
def login():
    return login_api()

@app.route('/databases', methods=['GET'])
def view_databases():
    """
    Returns list of database details from database_details table.
    """
    databases = get_postgresql_databases()
    return jsonify({"databases": databases})

@app.route('/logout_cleanup', methods=['POST'])
def logout_cleanup():
    clear_connected_databases()
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    app.run(debug=True)