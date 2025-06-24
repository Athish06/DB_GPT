from flask import Flask, request, jsonify
import requests
import ollama
import psycopg2
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# --- Configuration from Environment Variables ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", 5432)), # Default to 5432 if not set
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD")
}

# Set Ollama host for the ollama client library
ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11500")
# The ollama client library automatically uses OLLAMA_HOST env var, 
# but you can explicitly create a client if needed:
# ollama_client = ollama.Client(host=ollama_host)

OLLAMA_SQLCODER_MODEL = "mannix/defog-llama3-sqlcoder-8b"
OLLAMA_LLM_MODEL = "llama3" # Or "mistral", "gemma2", etc.

# --- Highly Refined SQLCoder System Prompt ---
SQLCODER_SYSTEM_PROMPT = (
    "You are an **expert PostgreSQL SQL query generator**, dedicated to creating precise, efficient, and syntactically correct SQL queries. Your intelligence is **strictly constrained by the provided database schema** and the explicit instructions given below. You MUST operate within these boundaries.\n"
    "Your primary and singular goal is to translate a user's natural language request into a valid PostgreSQL SQL query that **can be executed AGAINST THE PROVIDED SCHEMA ONLY**.\n\n"
    "--- **CRITICAL OUTPUT FORMAT RULES (NON-NEGOTIABLE FOR API USE)** ---\n"
    "1.  **IF YOU SUCCESSFULLY GENERATE SQL:** Your response MUST be **ONLY THE RAW SQL QUERY STRING**. Do NOT include any conversational text, explanations, greetings, preambles, postambles, or markdown code blocks (e.g., ```sql...```) around the SQL query. This is for direct API consumption.\n"
    "2.  **IF YOU REFUSE TO GENERATE SQL (for any reason below):** Your response MUST be **ONLY A CLEAR, CONCISE, NATURAL LANGUAGE MESSAGE** explaining *why* you cannot fulfill the request or asking for clarification. **UNDER NO CIRCUMSTANCES WHATSOEVER SHOULD YOU RETURN ANY SQL, PARTIAL SQL, OR CODE BLOCKS IF YOU ARE REFUSING TO GENERATE IT.** Your entire response in these cases must be *solely* the explanation or clarification request.\n\n"
    "--- **SQL GENERATION PRINCIPLES (STRICT ADHERENCE REQUIRED)** ---\n"
    "3.  **ABSOLUTE SCHEMA ADHERENCE (PARAMOUNT):** You MUST meticulously analyze the provided DDL statements (schema). All generated SQL must **STRICTLY AND EXCLUSIVELY** use tables, columns, and data types that are **EXPLICITLY PRESENT** in the provided schema. **YOU MUST NEVER INVENT OR ASSUME THE EXISTENCE OF TABLES, COLUMNS, OR RELATIONSHIPS NOT DEFINED IN THE GIVEN DDL.** This is a fundamental, uncompromisable constraint.\n"
    "4.  **Efficiency & Best Practices (PostgreSQL):**\n"
    "    - Generate efficient queries. Prefer explicit column names over `SELECT *` unless all columns are explicitly requested.\n"
    "    - Use appropriate `JOIN` clauses (e.g., `INNER JOIN`, `LEFT JOIN`) when querying across multiple tables. Infer relationships from foreign keys if present, or common column names, but **ONLY if both tables are strictly within the provided schema.**\n"
    "    - Apply necessary aggregation functions (`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`) and `GROUP BY` clauses when a question implies summarized data.\n"
    "    - Use PostgreSQL-specific functions and data type handling (e.g., `CAST`, `TO_DATE`, `DATE_TRUNC`, `ILIKE`).\n"
    "5.  **Direct Answer:** The generated SQL should directly answer the user's question based *only* on the available schema.\n\n"
    "--- **HANDLING USER REQUESTS & CONSTRAINTS (STRICT ADHERENCE REQUIRED)** ---\n"
    "6.  **ZERO HALLUCINATION (HIGHEST PRIORITY):** If the user's request implicitly or explicitly asks about data (e.g., 'dogs', 'products'), tables, or columns that **are not explicitly and fully defined in the provided schema**, you **MUST ABSOLUTELY REFUSE to generate any SQL**. Instead, provide a direct and unambiguous natural language message stating precisely *why* you cannot fulfill the request, for example: 'The requested table \"[table_name]\" or column \"[column_name]\" is not found in the provided database schema.' **THIS REFUSAL MESSAGE WILL BE YOUR ENTIRE AND SOLE RESPONSE. DO NOT INCLUDE ANY SQL, NO MATTER HOW RELEVANT IT SEEMS TO THE USER'S ORIGINAL QUESTION.**\n"
    "7.  **Irrelevant Questions:** If the user's question is completely unrelated to database querying or the provided schema (e.g., 'tell me a joke', 'what's the weather', 'explain LLMs'), you **MUST reply explicitly and strongly** that your function is to generate SQL queries based on the provided schema, and this question is outside your scope. **YOUR ENTIRE AND SOLE RESPONSE WILL BE THIS REFUSAL MESSAGE. DO NOT GENERATE ANY SQL OR SUGGEST RELATED DATABASE QUESTIONS.**\n"
    "8.  **Impossibility:** If the request is logically impossible to fulfill with SQL given the schema, state that it's beyond your capabilities. **YOUR ENTIRE AND SOLE RESPONSE WILL BE THIS EXPLANATION. DO NOT INCLUDE ANY SQL.**\n"
    "9.  **Ambiguity & Clarification:** If the user's request is ambiguous, vague, or unclear, you MUST ask for clarification by posing a precise question back to the user. **YOUR ENTIRE AND SOLE RESPONSE WILL BE THIS CLARIFICATION QUESTION. DO NOT INCLUDE ANY SQL.**\n"
    "10. **Spelling/Syntax Correction (User's Prompt):** You may intelligently correct minor spelling mistakes or grammatical errors in the user's natural language question, *but ONLY if the intended meaning remains unambiguous and directly relates to the provided schema*.\n"
    "11. **DDL Statements:** If the user explicitly asks for a Data Definition Language (DDL) statement (e.g., to create, alter, or drop a table), generate the appropriate DDL SQL.\n"
    "12. **Insufficient Context for Deterministic SQL:** If, even after analyzing the schema and the user's question, you cannot generate a **definitive and correct** SQL query, you MUST state this limitation clearly and either ask for the necessary missing information or explicitly state that you cannot generate a reliable query. **YOUR ENTIRE AND SOLE RESPONSE WILL BE THIS EXPLANATION. DO NOT GUESS OR GENERATE PROBABILISTIC SQL.**\n"
    "13. **Always use the table name and schema that is given as input for generating the SQL query. Do not assume any other table names or schemas.**\n"
    "14. **Always check if there is any relation to the prompt given by the user and the schema columns in the table selected.**"
)



def analyze_table_data(db_config, table_name, user_prompt, want_sql=False):
    """
    Core logic to fetch schema, generate SQL, execute it, and summarize results.
    Now supports: 
    - SELECT queries via SQLCoder
    - Modifying queries (INSERT, UPDATE, DELETE, etc.) via Llama3
    """
    conn = None
    cur = None

    # --- 1. Fetch table schema ---
    schema_ddl_statements = ""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute(f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = '{table_name}' AND table_schema = 'public';
        """)
        schema_cols = cur.fetchall()

        if not schema_cols:
            return jsonify({"error": f"Table '{table_name}' not found or no columns found in public schema."}), 404

        schema_ddl_statements = f"CREATE TABLE {table_name} (\n"
        schema_ddl_statements += ",\n".join([f"    {col[0]} {col[1]}" for col in schema_cols])
        schema_ddl_statements += "\n);"
        print(f"Schema for table '{table_name}':\n{schema_ddl_statements}")

        # --- NEW: Check for required column existence ---
        columns = [col[0] for col in schema_cols]
        required_column = 'name'  # or whatever column you want to check
        if required_column.lower() not in [c.lower() for c in columns]:
            error_msg = f"The required column '{required_column}' does not exist in the table '{table_name}'."
            summary = summarize_error_with_llama3(user_prompt, error_msg)
            return jsonify({"summary": summary, "results": [], "action_status": {}})

    except Exception as e:
        print(f"Error fetching schema: {e}")
        return jsonify({"error": f"Error connecting to database or fetching schema: {e}"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    # --- NEW STEP: Validate relevance using LLM ---
    relevance_check_prompt = f"""
You are a database assistant. You must check whether the user's question relates to the provided database schema.

Schema:
{schema_ddl_statements}

User Question:
"{user_prompt}"

Is this question related to the schema above? Answer only "YES" or "NO".
"""

    relevance_response = None
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
            summary = summarize_error_with_llama3(user_prompt, error_msg)
            return jsonify({"summary": summary, "results": [], "action_status": {}})

    except Exception as e:
        print(f"Error checking prompt relevance: {e}")
        return jsonify({"error": "Failed to validate question against schema.", "details": str(e)}), 500

    # --- 2. Decide which LLM to use for SQL generation ---
    # If the user prompt is about modifying operations, use Llama3; else use SQLCoder
    modifying_keywords = ["insert", "update", "delete", "alter", "drop", "create", "truncate"]
    is_modifying = any(user_prompt.strip().lower().startswith(kw) for kw in modifying_keywords)

    sql_query = ""
    llm_error_response = None

    try:
        if is_modifying:
            # Use Llama3 for modifying operations
            llama3_messages = [
                {
                    'role': 'system',
                    'content': (
                        "You are an expert PostgreSQL SQL query generator. "
                        "Given the schema and a user request for a data-modifying operation (INSERT, UPDATE, DELETE, etc.), "
                        "generate ONLY the SQL query string. Do not include explanations or markdown. and generate query for complete schema and do not include only what is given by the user for adding new data"
                    )
                },
                {
                    'role': 'user',
                    'content': (
                        f"Schema:\n{schema_ddl_statements}\n\n"
                        f"User Request: {user_prompt}\n\n"
                        f"Generate ONLY the full (i mean for adding follow entire schema '{schema_ddl_statements}') SQL query (use ILIKE for data validation) for this operation and use the schema of the table '{table_name}' that is '{schema_ddl_statements}' for clarification."
                    )
                }
            ]
            llama3_response = ollama.chat(
                model=OLLAMA_LLM_MODEL,
                messages=llama3_messages,
                options={"temperature": 0.0}
            )
            sql_query_raw_output = llama3_response['message']['content'].strip()
            print(f"Llama3 (modifying op) response: {sql_query_raw_output}")
        else:
            # Use SQLCoder for SELECT and other queries
            sqlcoder_messages = [
                {
                    'role': 'system',
                    'content': f"{SQLCODER_SYSTEM_PROMPT}\n\nDDL statements for current query context:\n{schema_ddl_statements}"
                },
                {
                    'role': 'user',
                    'content': f"Generate ONLY  full (i mean follow entire schema '{schema_ddl_statements}' for generating the query and dont use 'AS' unless view is necessary (since ans is only going to be returned try avoid using 'AS') and try to find simple queries) SQL query without any single or double quotes other than for strings and use proper syntax for execution for the following request: '{user_prompt}' and strictly use the schema of the '{table_name}' table  and check if the required column exists else do not generate"
                }
            ]
            sqlcoder_response = ollama.chat(
                model=OLLAMA_SQLCODER_MODEL,
                messages=sqlcoder_messages,
                options={"temperature": 0.0}
            )
            sql_query_raw_output = sqlcoder_response['message']['content'].strip()
            print(f"SQLCoder response: {sql_query_raw_output}")

        # --- Extract SQL query from the response ---
        sql_lines = sql_query_raw_output.splitlines()
        print(sql_lines)
        sql_keywords = ("SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE", "WITH")
        for line in sql_lines:
            upper_line = line.upper()
            for keyword in sql_keywords:
                idx = upper_line.find(keyword)
                if idx != -1:
                    # Check if there is a '(' just before the keyword (e.g., "(SELECT ...")
                    prefix = line[:idx].rstrip()
                    if prefix.endswith('('):
                        sql_query = prefix[-1] + line[idx:].strip()  # add '(' before the SQL
                    else:
                        sql_query = line[idx:].strip()
                    print(f"Extracted SQL query: {sql_query}")
                    break
            if sql_query:
                break

        if not sql_query:
            llm_error_response = sql_query_raw_output
            print(f"No valid SQL query found in response: {llm_error_response}")

    except requests.exceptions.ConnectionError as e:
        return jsonify({"error": f"Could not connect to Ollama server at {ollama_host}. Please ensure Ollama is running and the model is pulled. Error: {e}"}), 503
    except Exception as e:
        print(f"Error calling LLM for SQL generation: {e}")
        return jsonify({"error": f"LLM SQL generation error: {e}"}), 500

    if llm_error_response:
        response = {
            "summary": llm_error_response,
            "results": [],
            "action_status": {}
        }
        if want_sql:
            response["sql_query"] = "N/A - SQL generation refused."
        return jsonify(response)

    # --- 3. Execute the SQL query (support multiple queries) ---
    results = []
    action_status = {}
    is_select_query = False
    print(f"Executing SQL query: {sql_query}")

    conn = None
    cur = None
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()

        # Support multiple SQL statements separated by semicolon
        queries = [q.strip() for q in sql_query.split(';') if q.strip()]
        # --- Add ; to end of each query if it does not exist ---
        queries = [q if q.endswith(';') else q + ';' for q in queries]
        multi_results = []
        multi_action_status = []

        for idx, single_query in enumerate(queries):
            print(f"Executing query {idx+1}: {single_query}")
            # --- Case-insensitive handling for non-SELECT queries from Llama3 ---
            # If this is a modifying operation (not SELECT), make sure to compare lowercased
            query_type = single_query.strip().split()[0].lower() if single_query.strip() else ""
            is_select_query = query_type == "select" or query_type.startswith("(select")
            # For modifying operations, ensure case-insensitive execution logic
            if not is_select_query:
                # You can add any additional logic here if you want to process/validate further
                cur.execute(single_query)
                affected = cur.rowcount if hasattr(cur, 'rowcount') else 0
                conn.commit()
                multi_action_status.append({"rows_affected": affected})
                print(f"Non-SELECT query executed. Rows affected: {affected}")
            else:
                cur.execute(single_query)
                if cur.description:
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    result_set = [dict(zip(columns, row)) for row in rows]
                    multi_results.append(result_set)
                    print(f"SELECT query executed successfully. Retrieved {len(result_set)} rows.")
                else:
                    multi_results.append([])

        # If only one query, keep old structure for backward compatibility
        if len(queries) == 1:
            if is_select_query:
                results = multi_results[0]
            else:
                action_status = multi_action_status[0] if multi_action_status else {}
        else:
            # For multiple queries, return lists
            if any(q.strip().upper().startswith("SELECT") for q in queries):
                results = multi_results
            if any(not q.strip().upper().startswith("SELECT") for q in queries):
                action_status = multi_action_status

    except psycopg2.Error as e:
        error_message = f"Database execution error: {e.pgcode} - {e.pgerror}"
        print(error_message)
        if conn:
            conn.rollback()
            conn.close()
        summary = summarize_error_with_llama3(user_prompt, error_message)
        return jsonify({"summary": summary, "results": [], "action_status": {}, "sql_query": sql_query}), 500
    except Exception as e:
        print(f"Unexpected SQL execution error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        summary = summarize_error_with_llama3(user_prompt, str(e))
        return jsonify({"summary": summary, "results": [], "action_status": {}, "sql_query": sql_query}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"SQL query executed: {sql_query}")

    # --- 4. Summarize results using Llama3 ---
    summary = ""
    try:
        if is_select_query:
            results_str = json.loads(json.dumps(results, default=str)) if results else "No data found for this query."
            print(f"Results to summarize: {results_str}")
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
        else:  # DML/DDL operation
            status_info = f"Rows affected: {action_status.get('rows_affected', 'N/A')}" \
                if isinstance(action_status, dict) and 'rows_affected' in action_status else "Operation completed."
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
                        f"Execution Status: {status_info}\n\n"
                        f"Please provide a natural language confirmation."
                    )
                }
            ]

        print(f"Summary messages to be sent: {json.dumps(summary_messages, indent=2)}")
        summary_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=summary_messages,
            options={"temperature": 0.7}
        )
        summary = summary_response['message']['content'].strip()
        print(summary)
    except requests.exceptions.ConnectionError as e:
        summary = f"Could not connect to Ollama server for summarization at {ollama_host}. Error: {e}"
        print(f"Summary generation connection error: {e}")
    except Exception as e:
        summary = f"Could not summarize response due to an error: {e}"
        print(f"Summary generation unexpected error: {e}")

    response_payload = {
        "summary": summary,
    }
    if results:
        response_payload["results"] = results
    if action_status:
        response_payload["action_status"] = action_status

    if want_sql:
        response_payload["sql_query"] = sql_query
    print(jsonify(response_payload))

    return jsonify(response_payload)


def summarize_error_with_llama3(user_prompt, error_message):
    try:
        summary_messages = [
            {
                'role': 'system',
                'content': (
                    "You are a helpful assistant. The following error occurred while processing the user's request. "
                    "Explain to the user in simple, friendly language what went wrong, but do NOT mention technical details, database errors, or internal issues. "
                    "Instead, provide a general, polite message suggesting the user try again or check their request."
                )
            },
            {
                'role': 'user',
                'content': (
                    f"User's request: '{user_prompt}'\n"
                    f"Internal error: {error_message}\n"
                    f"Please provide a user-friendly explanation about what is the error clearly and concisely, without technical jargon or details."
                )
            }
        ]
        summary_response = ollama.chat(
            model=OLLAMA_LLM_MODEL,
            messages=summary_messages,
            options={"temperature": 0.7}
        )
        print(f"Error summary response: {summary_response['message']['content'].strip()}")
        return summary_response['message']['content'].strip()
    except Exception as e:
        return "Sorry, something went wrong while processing your request. Please try again later."


# --- Application Entry Point ---
if __name__ == '__main__':
    print("Flask app starting. Ensure Ollama server is running and models are pulled.")
    print(f"Ollama SQLCoder Model: {OLLAMA_SQLCODER_MODEL}")
    print(f"Ollama LLM Model (for summarization): {OLLAMA_LLM_MODEL}")
    print(f"Listening on port 5000...")
    app.run(host='0.0.0.0', port=5000)