from flask import Blueprint, request, jsonify
import psycopg2
import ollama
import os

OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3")

add_data_llama3_bp = Blueprint('add_data_llama3', __name__)

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
        print(db_config["database"])
        # Use double quotes for table and column names for PostgreSQL compatibility
        columns = ', '.join([f'"{col}"' for col in row_data.keys()])
        placeholders = ', '.join(['%s'] * len(row_data))
        values = list(row_data.values())
        sql = f'INSERT INTO {table_name} ({columns}) VALUES ({placeholders})'
        cur.execute(sql, values)
        conn.commit()
        cur.close()
        conn.close()
        return True, None
    except Exception as e:
        print(f"Error inserting data: {e}")
        return False, str(e)
    
def fetch_table_schema(conn, table_name):
    cur = conn.cursor()
    cur.execute(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = %s AND table_schema = 'public';
    """, (table_name,))
    schema_cols = cur.fetchall()
    cur.close()
    return schema_cols

def add_data_llama3():
    data = request.get_json()
    db_config = data.get("db_config")
    table_name = data.get("table_name")
    user_prompt = data.get("user_prompt")  
    print(table_name, user_prompt)

    if not db_config or not table_name or not user_prompt:
        return jsonify({"error": "Missing required fields"}), 400

    # 1. Fetch schema
    try:
        conn = psycopg2.connect(
            host=db_config["host"],
            database=db_config["database"],
            user=db_config["user"],
            password=db_config["password"]
        )
        schema_cols = fetch_table_schema(conn, table_name)
        print(f"Schema columns for {table_name}: {schema_cols}")
        if not schema_cols:
            return jsonify({"error": f"Table '{table_name}' not found or no columns found."}), 404
        schema_ddl = f"CREATE TABLE {table_name} (\n" + ",\n".join([f"    {col[0]} {col[1]}" for col in schema_cols]) + "\n);"
    except Exception as e:
        return jsonify({"error": f"Error connecting to database or fetching schema: {e}"}), 500
    finally:
        if conn:
            conn.close()

    # 2. Refine user prompt using Llama3
    try:
        refine_prompt_messages = [
            {
                'role': 'system',
                'content': (
                    "You are an expert assistant that helps users interact with a PostgreSQL database. "
                    "Given the table schema and a user request, rewrite or clarify the user's request so that it is as clear, specific, and unambiguous as possible, "
                    "using the actual table and column names from the schema. "
                    "If the user's request is already clear and matches the schema, return it as is. "
                    "Do NOT generate SQL, just return the improved or clarified user request."
                )
            },
            {
                'role': 'user',
                'content': (
                    f"Table schema:\n{schema_ddl}\n\n"
                    f"Original user request: {user_prompt}\n\n"
                    f"Please rewrite or clarify using appropriate words (related to the context of the query given by the user) in BRIEF but more clearer with all requirements needed in the user's request using the schema above."
                )
            }
        ]
        refine_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=refine_prompt_messages,
            options={"temperature": 0.0}
        )
        refined_prompt = refine_response['message']['content'].strip()
        print(f"Refined prompt: {refined_prompt}")
        user_prompt = refined_prompt  # Update user_prompt with refined version
    except Exception as e:
        refined_prompt = user_prompt  # fallback

    # 2.5. Relevance check using Llama3 (add after prompt refinement, before SQL generation)
    relevance_check_prompt = f"""
You are a database assistant. You must check whether the user's question relates to the provided database schema.

Schema:
{schema_ddl}

User Question:
"{user_prompt}"

Is this question related to the schema above? Answer only "YES" or "NO".
"""
    try:
        relevance_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=[{"role": "user", "content": relevance_check_prompt}],
            options={"temperature": 0.0}
        )
        relevance_answer = relevance_response['message']['content'].strip().upper()
        print(f"Relevance check response: {relevance_answer}")

        if relevance_answer != "YES":
            error_msg = "The question does not relate to the database schema."
            print(error_msg)
            # You can use your summarize_error_with_llama3 if you want a friendly message
            return jsonify({"summary": error_msg, "results": [], "action_status": {}}), 400
    except Exception as e:
        print(f"Error checking prompt relevance: {e}")
        return jsonify({"error": "Failed to validate question against schema.", "details": str(e)}), 500

    # 3. Generate INSERT SQL using Llama3
    try:
        llama3_messages = [
            {
                'role': 'system',
                'content': (
                    "You are an expert PostgreSQL SQL query generator. "
                    "Given the schema and a user request for a data-modifying operation (INSERT), (UPDATE), or (ALTER)"
                    "generate ONLY the SQL query string. Do not include explanations or markdown."
                )
            },
            {
                'role': 'user',
                'content': (
                    f"Schema:\n{schema_ddl}\n\n"
                    f"User Request: {refined_prompt}\n\n"
                    f"Generate ONLY  full (i mean follow entire schema '{schema_cols}' for generating the query ) and try to find simple queries) INSERT SQL query without any single or double quotes other than for strings and use proper syntax for execution for the following request: '{schema_cols}' and strictly use the schema of the '{table_name}' table  and check if the required column exists else do not generate"
                )
            }
        ]
        llama3_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=llama3_messages,
            options={"temperature": 0.0}
        )
        sql_query_raw_output = llama3_response['message']['content'].strip()
        print(f"Llama3 raw SQL output: {sql_query_raw_output}")
        # Extract SQL query (handle possible parentheses)
        sql_lines = sql_query_raw_output.splitlines()
        print(f"SQL lines: {sql_lines}")
        sql_query = ""
        sql_keywords = ("INSERT",)
        for line in sql_lines:
            upper_line = line.upper()
            for keyword in sql_keywords:
                idx = upper_line.find(keyword)
                if idx != -1:
                    prefix = line[:idx].rstrip()
                    if prefix.endswith('('):
                        sql_query = prefix[-1] + line[idx:].strip()
                    else:
                        sql_query = line[idx:].strip()
                    break
            if sql_query:
                break
        if not sql_query:
            return jsonify({"error": "No valid SQL INSERT query found in Llama3 response.", "llama3_response": sql_query_raw_output}), 400
    except Exception as e:
        return jsonify({"error": f"Error generating SQL with Llama3: {e}"}), 500

    # 4. Execute the query (with up to 3 rounds of Llama3 correction if syntax error)
    max_attempts = 3
    attempt = 0
    executed = False
    last_error = None
    while attempt < max_attempts and not executed:
        try:
            conn = psycopg2.connect(
                host=db_config["host"],
                database=db_config["database"],
                user=db_config["user"],
                password=db_config["password"]
            )
            cur = conn.cursor()
            # Remove unnecessary outer brackets
            stripped_query = sql_query.strip()
            if stripped_query.startswith('(') and stripped_query.endswith(')'):
                sql_query = stripped_query[1:-1].strip()
            cur.execute(sql_query)
            conn.commit()
            cur.close()
            conn.close()
            executed = True
        except psycopg2.Error as e:
            last_error = e
            if e.pgcode == '42601':  # Syntax error
                # Ask Llama3 to fix the query
                fix_messages = [
                    {
                        'role': 'system',
                        'content': (
                            "You are an expert PostgreSQL SQL syntax fixer. "
                            "Given a SQL query that failed due to a syntax error, correct the query. "
                            "Reply ONLY with the corrected SQL query. Do not explain, do not add markdown, just the corrected SQL."
                        )
                    },
                    {
                        'role': 'user',
                        'content': (
                            f"The following SQL query failed due to a syntax error:\n{sql_query}\n"
                            f"Error message: {e.pgerror}\n"
                            f"Please provide the corrected SQL query."
                        )
                    }
                ]
                try:
                    fix_response = ollama.chat(
                        model=OLLAMA_LLM_MODEL,
                        messages=fix_messages,
                        options={"temperature": 0.0}
                    )
                    fixed_query = fix_response['message']['content'].strip()
                    if fixed_query.startswith('(') and fixed_query.endswith(')'):
                        fixed_query = fixed_query[1:-1].strip()
                    sql_query = fixed_query
                except Exception as fix_e:
                    break
            else:
                break
        except Exception as e:
            last_error = e
            break
        attempt += 1

    if not executed:
        return jsonify({"error": f"Failed to execute SQL after {max_attempts} attempts.", "details": str(last_error), "sql_query": sql_query}), 500

    # 5. Summarize result
    summary = "Data inserted successfully." if executed else "Failed to insert data."
    return jsonify({"summary": summary, "sql_query": sql_query, "success": executed})