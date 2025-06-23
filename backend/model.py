from flask import jsonify
import requests
import ollama
import psycopg2
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()
ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11500")
os.environ["OLLAMA_HOST"] = ollama_host

OLLAMA_SQLCODER_MODEL = "mannix/defog-llama3-sqlcoder-8b"
OLLAMA_LLM_MODEL = "llama3"

def analyze_table_data(db_config, table_name, user_prompt, want_sql=False):
    """
    1. Fetch table schema.
    2. Use SQLCoder to generate SQL for the prompt and schema.
    3. Execute SQL (handling SELECT vs. DML).
    4. Use Llama3 to summarize results/confirm actions.
    5. Return summary, raw results (if SELECT), and SQL if requested.
    """
    conn = None # Initialize conn outside try to ensure it's defined for finally block
    cur = None  # Initialize cur outside try

    # 1. Fetch table schema
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"],
            port=int(db_config.get("port", 5432))
        )
        cur = conn.cursor()
        
        # Fetch actual column names and types for robust DDL construction
        cur.execute(f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = '{table_name}' AND table_schema = 'public';
        """)
        schema_cols = cur.fetchall()
        
        if not schema_cols:
            return jsonify({"error": f"Table '{table_name}' not found or no columns found."}), 404

        # Construct full CREATE TABLE DDL for better context to SQLCoder
        schema_ddl_statements = f"CREATE TABLE {table_name} (\n"
        schema_ddl_statements += ",\n".join([f"    {col[0]} {col[1]}" for col in schema_cols])
        schema_ddl_statements += "\n);"
        
        print(f"Schema DDL for SQLCoder:\n{schema_ddl_statements}")
        cur.close()
        conn.close()
        print("Schema fetched successfully")
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": f"Error fetching schema: {e}"}), 500

    # 2. Generate SQL query using SQLCoder
    sqlcoder_messages = [
        {
            'role': 'system', # DDL statements go in the system role for optimal performance
            'content': f"Output valid PostgreSQL SQL.\nDDL statements:\n{schema_ddl_statements}"
        },
        {
            'role': 'user',
            'content': f"Generate a SQL query to answer this question: `{user_prompt}`"
        }
    ]
    print(f"SQLCoder messages to be sent: {json.dumps(sqlcoder_messages, indent=2)}") 
    
    sql_query = "" # Initialize sql_query
    try:
        sqlcoder_response = ollama.chat(
            model=OLLAMA_SQLCODER_MODEL,
            messages=sqlcoder_messages,
            options={"temperature": 0.5} # Low temperature for deterministic SQL
        )
        sql_query_raw = sqlcoder_response['message']['content'].strip()
        
        # Extract just the SQL part from the response
        if "```sql" in sql_query_raw and "```" in sql_query_raw:
            sql_query = sql_query_raw.split("```sql")[1].split("```")[0].strip()
        else:
            sql_query = sql_query_raw # Fallback if format is unexpected
        
        print(f"Extracted SQL Query: {sql_query}")

    except Exception as e:
        return jsonify({"error": f"SQLCoder error: {e}"}), 500

    # 3. Execute the SQL query
    results = [] # To store fetched data for SELECT queries
    action_status = {} # To store info for DML queries (e.g., rows affected)
    is_select_query = sql_query.strip().upper().startswith("SELECT")

    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"],
            port=int(db_config.get("port", 5432))
        )
        cur = conn.cursor()
        
        cur.execute(sql_query)
        
        if is_select_query:
            if cur.description: # Check if there are results (e.g., not an empty table or DML)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                results = [dict(zip(columns, row)) for row in rows]
            # If cur.description is None for a SELECT, it means no rows matched, results remains empty.
        else: # This is a DML statement (INSERT, UPDATE, DELETE)
            action_status["rows_affected"] = cur.rowcount
            conn.commit() # Commit changes for DML operations
            print(f"DML executed. Rows affected: {cur.rowcount}")

        cur.close()
        conn.close()
    except Exception as e:
        if conn: # Ensure connection is closed even on error
            conn.rollback() # Rollback changes on error for DML
            conn.close()
        return jsonify({"error": f"SQL execution error: {e}", "sql_query": sql_query}), 500

    # 4. Summarize results using Llama3
    summary = ""
    try:
        if is_select_query:
            results_str = json.dumps(results, indent=2) if results else "No results found."
            summary_messages = [
                {
                    'role': 'system',
                    'content': (
                        "You are a helpful assistant specialized in summarizing database query results in natural language. "
                        "Provide a concise and clear summary of the results based on the original question. "
                        "If the results are empty, state that no data was found. "
                        "Do not include the SQL query, schema, or raw data unless explicitly asked."
                    )
                },
                {
                    'role': 'user',
                    'content': (
                        f"Original Question: '{user_prompt}'\n\n"
                        f"Raw Query Results:\n```json\n{results_str}\n```\n\n"
                        f"Please provide a natural language summary."
                    )
                }
            ]
        else: # DML operation
            summary_messages = [
                {
                    'role': 'system',
                    'content': (
                        "You are a helpful assistant that confirms database operations in natural language. "
                        "Based on the user's request and the outcome of the SQL execution, "
                        "provide a clear and concise confirmation message. "
                        "Do not include the SQL query unless explicitly asked."
                    )
                },
                {
                    'role': 'user',
                    'content': (
                        f"User's request: '{user_prompt}'\n"
                        f"SQL Query Executed:\n```sql\n{sql_query}\n```\n\n"
                        f"Execution Status: {json.dumps(action_status)}\n\n"
                        f"Please provide a natural language confirmation."
                    )
                }
            ]

        print(f"Summary messages to be sent: {json.dumps(summary_messages, indent=2)}")
        summary_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=summary_messages,
            options={"temperature": 0.7} # Higher temperature for more natural language
        )
        summary = summary_response['message']['content'].strip()
    except Exception as e:
        summary = f"Could not summarize response due to an error: {e}"
        print(f"Summary generation error: {e}")

    # 5. Return summary, results (if SELECT), and SQL if requested
    response = {
        "summary": summary,
    }
    if is_select_query:
        response["results"] = results # Only include results for SELECT queries
    else:
        response["action_status"] = action_status # Include DML status
        
    if want_sql:
        response["sql_query"] = sql_query

    return jsonify(response)

