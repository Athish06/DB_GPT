import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from bson import ObjectId, json_util
import json
from datetime import datetime

from auth import login_api, signup_api, require_auth
from db.mongo_client import get_project_db, init_db_indexes
from services.connector_factory import get_connector
from services.db_connector import DBConfig, DBType
from services.encryption import encryption_service
from services.schema_cache import schema_cache_service
import asyncio
from services.agent import run_chat_turn
from services.conversation import conversation_manager

app = Flask(__name__)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
CORS(app, supports_credentials=True, origins=[FRONTEND_URL])

# Initialize MongoDB collections and indexes lazily to prevent Werkzeug Windows socket crashes
_indexes_initialized = False

@app.before_request
def initialize_indexes_once():
    global _indexes_initialized
    if not _indexes_initialized:
        init_db_indexes()
        _indexes_initialized = True

def _get_user_db_config(user_id: str, db_id: str) -> DBConfig:
    db = get_project_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")
        
    db_entry = next((d for d in user.get("databases", []) if str(d["db_id"]) == db_id), None)
    if not db_entry:
        raise ValueError("Database not found")
        
    return DBConfig(
        type=DBType(db_entry["type"]),
        host=db_entry["host"],
        port=db_entry["port"],
        database_name=db_entry["database_name"],
        username=encryption_service.decrypt(db_entry["username_encrypted"]) if db_entry.get("username_encrypted") else "",
        password=encryption_service.decrypt(db_entry["password_encrypted"]) if db_entry.get("password_encrypted") else "",
        ssl_required=db_entry.get("ssl_required", False),
        connection_string=(
            encryption_service.decrypt(db_entry["connection_string_encrypted"])
            if db_entry.get("connection_string_encrypted") else None
        )
    )

@app.route('/connect_db', methods=['POST'])
@require_auth
def connect_db():
    data = request.get_json()
    db_id = data.get("db_id")
    if not db_id:
        return jsonify({"status": "error", "message": "Missing db_id"}), 400
        
    try:
        db_config = _get_user_db_config(g.user_id, db_id)
        connector = get_connector(db_config)
        success, error = connector.test_connection()
        connector.close()
        
        if success:
            return jsonify({"status": "success", "message": "Database connection successful."}), 200
        else:
            return jsonify({"status": "error", "message": error}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/tables', methods=['POST'])
@require_auth
def view_tables():
    """
    Expects JSON with db_id.
    Returns list of table/collection names.
    """
    data = request.get_json()
    db_id = data.get("db_id")
    if not db_id:
        return jsonify({"error": "Missing db_id"}), 400
        
    try:
        db_config = _get_user_db_config(g.user_id, db_id)
        connector = get_connector(db_config)
        tables = connector.get_tables_or_collections()
        connector.close()
        return jsonify({"tables": tables})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/table/<table_name>', methods=['POST'])
@require_auth
def view_table_data(table_name):
    """
    Expects JSON with db_id.
    Returns data from the specified table.
    """
    data = request.get_json()
    db_id = data.get("db_id")
    if not db_id:
        return jsonify({"error": "Missing db_id"}), 400
        
    try:
        db_config = _get_user_db_config(g.user_id, db_id)
        connector = get_connector(db_config)
        
        if db_config.type in (DBType.POSTGRESQL, DBType.SUPABASE):
            rows, _ = connector.execute_sql(f"SELECT * FROM {table_name} LIMIT 100")
            connector.close()
            return jsonify(rows)
        elif db_config.type == DBType.MONGODB:
            rows, _ = connector.execute_mongodb_find(table_name, {}, {}, {}, 100)
            connector.close()
            # Safely serialize nested BSON types like ObjectId and datetimes
            safe_rows = json.loads(json_util.dumps(rows))
            return jsonify(safe_rows)
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/add_data', methods=['POST'])
@require_auth
def add_data_api():
    data = request.get_json()
    db_id = data.get('db_id')
    table_name = data.get('table_name')
    row_data = data.get('data')
    
    if not db_id or not table_name or not row_data:
        return jsonify({"success": False, "error": "Missing required fields"}), 400
        
    try:
        db_config = _get_user_db_config(g.user_id, db_id)
        connector = get_connector(db_config)
        success, error = connector.insert_row(table_name, row_data)
        connector.close()
        
        if success:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"success": False, "error": error}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    return login_api()

@app.route('/signup', methods=['POST'])
def signup():
    return signup_api()

@app.route('/databases', methods=['GET'])
@require_auth
def view_databases():
    """
    Returns list of database details for the current user.
    """
    try:
        db = get_project_db()
        user = db.users.find_one({"_id": ObjectId(g.user_id)})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        databases = user.get("databases", [])
        safe_databases = []
        for db_entry in databases:
            safe_db = {
                "db_id": str(db_entry["db_id"]),
                "display_name": db_entry.get("display_name", db_entry["database_name"]),
                "type": db_entry["type"],
                "database_name": db_entry["database_name"],
                "host": db_entry["host"],
                "port": db_entry["port"],
                "ssl_required": db_entry.get("ssl_required", False),
                "connection_status": db_entry.get("connection_status", "unknown")
            }
            safe_databases.append(safe_db)
            
        return jsonify({"databases": safe_databases})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/logout_cleanup', methods=['POST'])
def logout_cleanup():
    # No longer needed with stateless connections, just clear cookie
    response = jsonify({"status": "cleared"})
    response.set_cookie('jwt_token', '', expires=0)
    return response

@app.route('/add_db', methods=['POST'])
@require_auth
def add_db():
    data = request.get_json()
    print(data)
    # Required fields for PostgreSQL/Supabase
    # Or connection_string for MongoDB
    
    new_db_id = ObjectId()
    db_type = data.get("type", "postgresql")
    
    db_entry = {
        "db_id": new_db_id,
        "display_name": data.get("display_name", data.get("database_name", "My DB")),
        "type": db_type,
        "database_name": data.get("database_name", ""),
        "host": data.get("host", ""),
        "port": int(data.get("port", 5432)),
        "username_encrypted": encryption_service.encrypt(data.get("user_name", "")) if data.get("user_name") else "",
        "password_encrypted": encryption_service.encrypt(data.get("password", "")) if data.get("password") else "",
        "ssl_required": data.get("ssl_required", False),
        "connection_string_encrypted": encryption_service.encrypt(data.get("connection_string", "")) if data.get("connection_string") else "",
        "created_at": datetime.utcnow(),
        "connection_status": "unknown"
    }
    try:
        db = get_project_db()
        db.users.update_one(
            {"_id": ObjectId(g.user_id)},
            {"$push": {"databases": db_entry}}
        )
        return jsonify({"status": "success", "message": "Database added successfully."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
@require_auth
def api_chat():
    data = request.get_json()
    db_id = data.get("db_id")
    target = data.get("target")  # table or collection name
    message = data.get("message")
    conversation_id = data.get("conversation_id")
    
    if not all([db_id, target, message]):
        return jsonify({"error": "Missing db_id, target, or message"}), 400
        
    try:
        db = get_project_db()
        user = db.users.find_one({"_id": ObjectId(g.user_id)})
        groq_key_encrypted = user.get("groq_api_key_encrypted")
        if not groq_key_encrypted:
            return jsonify({"error": "Groq API key not set in user settings"}), 403
            
        groq_api_key = encryption_service.decrypt(groq_key_encrypted)
        db_config = _get_user_db_config(g.user_id, db_id)
        
        # Load or create conversation
        if conversation_id:
            conversation = conversation_manager.get_conversation(g.user_id, conversation_id)
            if not conversation:
                return jsonify({"error": "Conversation not found"}), 404
        else:
            conversation = conversation_manager.create_new_conversation(
                g.user_id, db_id, db_config.database_name, db_config.type.value if hasattr(db_config.type, 'value') else db_config.type, target
            )
        
        conversation_manager.append_message(str(conversation["_id"]), "user", message)
        
        # Check cache, introspect if missing
        schema_data = schema_cache_service.get(g.user_id, db_id)
        connector = get_connector(db_config)
        
        if not schema_data:
            tables = connector.get_tables_or_collections()
            schemas = {}
            for t in tables:
                try:
                    schemas[t] = connector.get_schema(t)
                except Exception as e:
                    print(f"Failed to fetch schema for {t}: {e}")
                
            schema_data = {
                "sql_schemas": schemas if db_config.type in (DBType.POSTGRESQL, DBType.SUPABASE) else {},
                "mongo_schemas": schemas if db_config.type == DBType.MONGODB else {}
            }
            schema_cache_service.set(g.user_id, db_id, schema_data)
        
        # Run agent
        result = asyncio.run(run_chat_turn(
            message,
            {**db_config.__dict__, "type": db_config.type.value if hasattr(db_config.type, 'value') else db_config.type},
            target,
            schema_data,
            conversation,
            groq_api_key,
            connector
        ))
        
        connector.close()
        
        conversation_manager.append_message(
            str(conversation["_id"]), 
            "assistant", 
            result["reply"], 
            {
                "generated_query": result["generated_query"],
                "query_type": result["query_type"],
                "result_row_count": result["result_row_count"],
                "execution_time_ms": result["execution_time_ms"],
                "error": result["error"]
            }
        )
        
        # Async compress
        conversation_manager.maybe_compress(str(conversation["_id"]), groq_api_key)
        
        result["conversation_id"] = str(conversation["_id"])
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/groq-key', methods=['POST'])
@require_auth
def update_groq_key():
    data = request.get_json()
    key = data.get("groq_api_key")
    if not key:
        return jsonify({"error": "Missing groq_api_key"}), 400
        
    try:
        db = get_project_db()
        encrypted_key = encryption_service.encrypt(key)
        db.users.update_one(
            {"_id": ObjectId(g.user_id)},
            {"$set": {"groq_api_key_encrypted": encrypted_key}}
        )
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    db = get_project_db()
    user = db.users.find_one({"_id": ObjectId(g.user_id)})
    has_key = bool(user.get("groq_api_key_encrypted"))
    settings = user.get("settings", {})
    return jsonify({"has_groq_key": has_key, "settings": settings})

@app.route('/api/conversations', methods=['GET'])
@require_auth
def list_conversations():
    db = get_project_db()
    query = {"user_id": g.user_id}
    
    db_id = request.args.get("db_id")
    target = request.args.get("target")
    if db_id:
        query["db_id"] = db_id
    if target:
        query["target"] = target

    cursor = db.conversations.find(
        query,
        {"messages": 0} # Exclude full message history
    ).sort("updated_at", -1)
    
    convs = []
    for c in cursor:
        c["_id"] = str(c["_id"])
        convs.append(c)
    return jsonify(convs)

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
@require_auth
def get_conversation_api(conversation_id):
    conv = conversation_manager.get_conversation(g.user_id, conversation_id)
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
        
    conv["_id"] = str(conv["_id"])
    for msg in conv.get("messages", []):
        if "message_id" in msg:
            msg["message_id"] = str(msg["message_id"])
    return jsonify(conv)

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
@require_auth
def delete_conversation_api(conversation_id):
    success = conversation_manager.delete_conversation(g.user_id, conversation_id)
    if success:
        return jsonify({"success": True}), 200
    return jsonify({"error": "Conversation not found or deletion failed"}), 404

if __name__ == "__main__":
    # Disable Werkzeug reloader on Windows to prevent PyMongo socket clashes (WinError 10038)
    app.run(debug=True, use_reloader=False)