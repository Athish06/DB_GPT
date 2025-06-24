from flask import Flask, request, jsonify
from flask_cors import CORS
from database_connection import connect_postgresql_from_json, add_database_details
from tables_view import get_postgresql_tables, get_postgresql_table_data 

from add_data import new_data
from auth import login_api, signup_api
from database_view import get_postgresql_databases, clear_connected_databases
from add_data import add_data_llama3_bp

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

@app.route('/signup', methods=['POST'])
def signup():
    return signup_api()

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

@app.route('/add_db', methods=['POST'])
def add_db():
    db_config = request.get_json()
    success, error = add_database_details(db_config)
    if success:
        return jsonify({"status": "success", "message": "Database added and connected."}), 200
    else:
        return jsonify({"status": "error", "message": error}), 500

@app.route('/analyze_table', methods=['POST'])
def analyze_table():
    """
    Expects JSON: { "db_config": {...}, "table_name": "...", "prompt": "...", "want_sql": true/false }
    Calls the model's analyze_table function.
    """
    from model import analyze_table_data  # Import here to avoid circular import
    data = request.get_json()
    db_config = data.get("db_config")
    table_name = data.get("table_name")
    prompt = data.get("prompt", "")
    want_sql = data.get("want_sql", False)
    print(f"Received request to analyze table: {table_name} with prompt: {prompt} and want_sql: {want_sql}")
    if not db_config or not table_name or not prompt:
        return jsonify({"error": "Missing db_config, table_name, or prompt"}), 400
    return analyze_table_data(db_config, table_name, prompt, want_sql)

app.register_blueprint(add_data_llama3_bp, url_prefix="")

@app.route('/add_data_ai', methods=['POST'])
def add_data_ai():
    """
    Expects JSON: { "db_config": {...}, "table_name": "...", "user_prompt": "..." }
    Uses Llama3-powered data insertion logic.
    """
    try:
        from add_data import add_data_llama3
    except ImportError:
        return jsonify({"error": "add_data_llama3 module not found"}), 500
    return add_data_llama3()

if __name__ == "__main__":
    app.run(debug=True)