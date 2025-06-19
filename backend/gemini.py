from flask import Blueprint, request, jsonify
import google.generativeai as genai
import os

ai_bp = Blueprint('ai', __name__)

# Configure Gemini API
api_key = "AIzaSyBC-7CdQrkIAfjIrfVzrRzOAHKFZftoO2I"  # Replace with your actual Gemini API key
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

def generate_dml_proposal(user_request: str, schema_info: dict, db_type: str = "PostgreSQL") -> str | None:
    schema_str = ""
    if db_type == "PostgreSQL":
        table_name = schema_info.get("table_name", "UNKNOWN_TABLE")
        columns = schema_info.get("columns", [])
        column_defs = [f"{col['name']}: {col['type']} ({'Primary Key)' if col.get('is_primary_key') else ''}" for col in columns]
        schema_str = f"Table '{table_name}' schema:\n" + "\n".join(column_defs)
        output_format_instruction = "Generate ONLY the SQL DML statement (INSERT, UPDATE, or DELETE). Do NOT include any comments, explanations, or backticks."
    else:
        return None

    prompt = f"""
    You are an AI assistant that translates natural language and analyse them and provide valid outputs using the input given by the user that must be simple and clear and detailed if necessary.
    Target Database Type: {db_type}

    {schema_str}

    User Request: {user_request}

    {output_format_instruction}
    """
    try:
        response = model.generate_content(prompt)
        proposed_dml = response.text.strip()
        return proposed_dml
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return None
