import google.generativeai as genai
import os
import json # For structured schema, or if LLM returns JSON
import psycopg2 # For PostgreSQL example

# --- 1. Gemini API Configuration ---
# Instead of using environment variable, set your API key here directly
api_key = "AIzaSyBC-7CdQrkIAfjIrfVzrRzOAHKFZftoO2I"  # Replace with your actual Gemini API key
if not api_key:
    raise ValueError("API key is not set. Please set it in the script before running.")
genai.configure(api_key=api_key)

# Initialize the Gemini model
# --- ALTERED: Using 'gemini-1.5-flash' as requested ---
# Note: Model names can sometimes vary (e.g., 'gemini-1.5-flash-latest').
# Always check the latest available models via Google AI Studio or the API documentation.
model = genai.GenerativeModel('gemini-1.5-flash') 

print("Gemini API configured successfully using Gemini 1.5 Flash.\n")

# --- 2. Function to Generate DML Proposal using Gemini API ---
def generate_dml_proposal(user_request: str, schema_info: dict, db_type: str = "PostgreSQL") -> str | None:
    """
    Calls the Gemini API to generate a DML (INSERT, UPDATE, DELETE) statement.

    Args:
        user_request (str): The natural language request from the user (e.g., "Change John's email to...").
        schema_info (dict): A dictionary representing the relevant database schema (e.g., table/collection name, columns/fields with types).
        db_type (str): The type of the target database (e.g., "PostgreSQL", "MongoDB").

    Returns:
        str | None: The proposed DML statement as a string, or None if an error occurs.
    """
    # Customize this prompt carefully based on your desired LLM output format
    # and the level of detail in your schema_info.
    # For robust production use, consider using the 'Instructor' library
    # to enforce a structured JSON output from the LLM, making parsing and validation easier.
    
    schema_str = ""
    if db_type == "PostgreSQL":
        table_name = schema_info.get("table_name", "UNKNOWN_TABLE")
        columns = schema_info.get("columns", [])
        column_defs = [f"{col['name']}: {col['type']} ({'Primary Key)' if col.get('is_primary_key') else ''}" for col in columns]
        schema_str = f"Table '{table_name}' schema:\n" + "\n".join(column_defs)
        output_format_instruction = "Generate ONLY the SQL DML statement (INSERT, UPDATE, or DELETE). Do NOT include any comments, explanations, or backticks."
    else:
        # Add support for other database types here
        print(f"Warning: Unsupported database type '{db_type}' for DML generation.")
        return None

    prompt = f"""
    You are an AI assistant that translates natural language requests into database DML statements.
    Target Database Type: {db_type}

    {schema_str}

    User Request: {user_request}

    {output_format_instruction}
    """
    
    try:
        response = model.generate_content(prompt)
        # Ensure the response is stripped of any surrounding whitespace or markdown.
        proposed_dml = response.text.strip()
        return proposed_dml
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return None

# --- 3. Functions to Execute DML on Specific Database Types ---

def execute_postgresql_dml(db_config: dict, dml_statement: str) -> dict:
    """Executes a DML statement on a PostgreSQL database."""
    conn = None
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute(dml_statement)
        conn.commit() # IMPORTANT: Commit the transaction
        rows_affected = cursor.rowcount
        cursor.close()
        conn.close()
        return {"status": "success", "message": f"PostgreSQL database updated. Rows affected: {rows_affected}"}
    except Exception as e:
        print(f"Error executing PostgreSQL DML: {e}")
        if conn:
            conn.rollback() # Rollback in case of error
        return {"status": "error", "message": f"Failed to update PostgreSQL database: {str(e)}"}
    finally:
        if conn:
            conn.close()


# --- 4. Main Workflow Example ---

if __name__ == "__main__":
    # --- Simulate User Input & Schema ---
    user_request = "insert a new row with id 'otha' and password 'bard' into the technicians table in PostgreSQL database MedLab"
    
    # Example PostgreSQL schema aligned with user request
    postgresql_schema = {
      "table_name": "technicians",
      "columns": [
        {"name": "id", "type": "TEXT", "is_primary_key": True},
        {"name": "password", "type": "TEXT"},

      ]
    }
    
    # Database Configuration (replace with your actual details and secure methods)
    pg_db_config = {
        "host": "localhost",
        "database": "MedLab",
        "user": "postgres",
        "password": "Athish2006"
    }
   
    # --- PART A: GENERATE PROPOSAL ---
    print("--- Generating DML Proposal (PostgreSQL) ---")
    proposed_dml_sql = generate_dml_proposal(user_request, postgresql_schema, "PostgreSQL")

    if proposed_dml_sql:
        print(f"\nProposed SQL from LLM:\n```sql\n{proposed_dml_sql}\n```")
        
        # --- PART B: SERVER-SIDE VALIDATION (CRITICAL!) ---
        # Implement your robust validation here.
        # This is where you'd check for:
        # 1. SQL syntax validity (using a parser like sqlglot or sqlparse)
        # 2. Security (no DROP TABLE, TRUNCATE, ALTER TABLE, etc.)
        # 3. Semantic correctness (columns exist, types match, user has permissions)
        
        is_dml_valid = True # Placeholder for actual validation result
        if not is_dml_valid:
            print("\nError: Proposed SQL failed validation. Aborting.")
            proposed_dml_sql = None # Invalidate to prevent execution
    else:
        print("\nFailed to get a DML proposal for PostgreSQL.")

    # --- PART C: USER REVIEW & CONFIRMATION (Frontend & Backend Interaction) ---
    # This is the crucial human-in-the-loop step.
    # In a real application:
    # 1. Backend would format `proposed_dml_sql` into a human-readable summary.
    #    E.g., "You are about to update rows in 'users' table. Email will change to 'john.doe.new@example.com' for John Doe."
    # 2. Backend sends this summary to the Frontend.
    # 3. Frontend displays the summary prominently to the user with "Confirm" and "Cancel" buttons.
    # 4. User clicks "Confirm".
    # 5. Frontend sends confirmation (and possibly the validated DML) back to the Backend.
    
    user_confirmed = False # Simulate user action
    if proposed_dml_sql and is_dml_valid:
        print("\n--- Awaiting User Confirmation (Simulated) ---")
        # In a real app, this would be an API call waiting for user input
        user_input = input("Do you confirm this database alteration? (yes/no): ").strip().lower()
        if user_input == 'yes':
            user_confirmed = True
            print("User confirmed.")
        else:
            print("User cancelled.")

    # --- PART D: EXECUTE DML (Only if Confirmed) ---
    if user_confirmed and proposed_dml_sql:
        print("\n--- Executing DML on PostgreSQL ---")
        execution_result = execute_postgresql_dml(pg_db_config, proposed_dml_sql)
        print(f"PostgreSQL Execution Result: {execution_result}")
    else:
        print("\nDatabase alteration cancelled or not executed due to invalid proposal/no confirmation.")

    print("\n" + "="*50 + "\n") # Separator
