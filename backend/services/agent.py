import json
import re
from typing import Dict, List, Optional, Tuple
from groq import Groq
import httpx
from services.db_connector import BaseDBConnector
from services.result_processor import result_processor
from services.conversation import conversation_manager

def format_schema_for_prompt(schema_cache: Dict, target_table: str,
                              db_type: str) -> str:
    if db_type in ("postgresql", "supabase"):
        schemas = schema_cache.get("sql_schemas", {})
        if target_table not in schemas:
            return f"-- Table '{target_table}' schema not available"
        cols = schemas[target_table]["columns"]
        ddl = f"CREATE TABLE {target_table} (\n"
        col_parts = []
        for col in cols:
            pk = " PRIMARY KEY" if col.get("is_primary_key") else ""
            nullable = "" if col.get("nullable") == "YES" else " NOT NULL"
            col_parts.append(f"    {col['name']} {col['data_type']}{pk}{nullable}")
        ddl += ",\n".join(col_parts) + "\n);"
        return ddl
    elif db_type == "mongodb":
        mongo_schemas = schema_cache.get("mongo_schemas", {})
        if target_table not in mongo_schemas:
            return f"-- Collection '{target_table}' schema not available"
        fields = mongo_schemas[target_table]["fields"]
        lines = [f"Collection: {target_table}", "Fields (inferred from document samples):"]
        for fname, fmeta in fields.items():
            ptype = fmeta.get("primary_type", "mixed")
            samples = fmeta.get("sample_values", [])
            sample_str = f"  (e.g. {samples[0]})" if samples else ""
            array_flag = " [array]" if fmeta.get("is_array") else ""
            lines.append(f"  {fname}: {ptype}{array_flag}{sample_str}")
        return "\n".join(lines)
    return "Schema unavailable"


SYSTEM_PROMPT_TEMPLATE = """You are DB_GPT, a precise database assistant.

DATABASE:
Type: {db_type}
Name: {db_name}
Target table/collection: {target}

SCHEMA:
{schema_ddl}

INSTRUCTIONS:
- Only answer questions related to the database and its data.
- For PostgreSQL/Supabase: generate valid PostgreSQL SQL.
- For MongoDB: generate valid pymongo operations as JSON dicts.
- Never reference tables or columns not shown in the schema.
- For queries that may return many rows, prefer aggregation.
- If the question is ambiguous, ask for clarification.
- Do not generate DROP, TRUNCATE, or ALTER statements unless explicitly asked.

Respond with ONLY this JSON (no markdown, no explanation outside the JSON):
{{
  "is_relevant": true,
  "rejection_reason": null,
  "needs_query": true,
  "query_type": "sql | mongodb_find | mongodb_aggregate | none",
  "sql": "SELECT ... or null",
  "mongodb_find": {{
    "collection": "name",
    "filter": {{}},
    "projection": {{}},
    "sort": {{}},
    "limit": 100
  }},
  "mongodb_pipeline": [
    {{"$match": {{}}}},
    {{"$group": {{}}}}
  ],
  "result_handling_hint": "full | sample_with_stats | aggregate_only",
  "explanation": "one line describing what this query does"
}}

If is_relevant is false: set rejection_reason, set all query fields to null.
If needs_query is false: set all query fields to null, put the direct answer in explanation."""

def get_groq_client(api_key: str) -> Groq:
    return Groq(api_key=api_key, http_client=httpx.Client())

def _extract_json(text: str) -> Dict:
    """Extract JSON from LLM output, handling common wrapping issues."""
    text = text.strip()
    # Remove markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    # Find first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")
    return json.loads(text[start:end+1])

async def run_chat_turn(
    user_message: str,
    db_config: Dict,
    target: str,
    schema_cache: Dict,
    conversation: Dict,
    groq_api_key: str,
    connector: BaseDBConnector
) -> Dict:
    """
    Run a full agent turn: analyze, query, process, respond.
    Returns dict with reply, metadata, and updated conversation data.
    """
    groq = get_groq_client(groq_api_key)
    db_type = db_config["type"].value if hasattr(db_config["type"], 'value') else db_config["type"]
    db_name = db_config["database_name"]

    schema_ddl = format_schema_for_prompt(schema_cache, target, db_type)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        db_type=db_type,
        db_name=db_name,
        target=target,
        schema_ddl=schema_ddl
    )

    # Build message history for context
    history_messages = conversation_manager.get_context_for_llm(conversation)

    # GROQ CALL 1: Analyze + Generate Query
    call1_messages = [
        {"role": "system", "content": system_prompt},
        *history_messages,
        {"role": "user", "content": user_message}
    ]

    call1_response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=call1_messages,
        temperature=0.0,
        max_tokens=1000,
        response_format={"type": "json_object"}
    )

    try:
        parsed = _extract_json(call1_response.choices[0].message.content)
    except ValueError as e:
        return {
            "reply": f"Internal agent error: Failed to parse LLM response. {e}",
            "generated_query": None,
            "query_type": "none",
            "result_row_count": None,
            "execution_time_ms": 0,
            "error": str(e)
        }

    # Handle irrelevant questions
    if not parsed.get("is_relevant", True):
        reply = (
            f"This question does not appear to relate to the '{target}' "
            f"database. {parsed.get('rejection_reason', '')} "
            f"Please ask something about the data in this database."
        )
        return {
            "reply": reply,
            "generated_query": None,
            "query_type": "none",
            "result_row_count": None,
            "execution_time_ms": 0,
            "error": None
        }

    # Handle questions that need no query (e.g., "what columns does this table have?")
    if not parsed.get("needs_query", True):
        return {
            "reply": parsed.get("explanation", ""),
            "generated_query": None,
            "query_type": "none",
            "result_row_count": None,
            "execution_time_ms": 0,
            "error": None
        }

    # Execute query with retry logic
    query_type = parsed.get("query_type", "sql")
    generated_query = None
    raw_results = []
    total_count = 0
    exec_error = None
    import time

    start_ts = time.time()
    for attempt in range(3):
        try:
            if query_type == "sql" and parsed.get("sql"):
                generated_query = parsed["sql"]
                raw_results, total_count = connector.execute_sql(generated_query)

            elif query_type == "mongodb_find" and parsed.get("mongodb_find"):
                op = parsed["mongodb_find"]
                generated_query = json.dumps(op)
                raw_results, total_count = connector.execute_mongodb_find(
                    op.get("collection") or target,
                    op.get("filter") or {},
                    op.get("projection") or {},
                    op.get("sort") or {},
                    op.get("limit") or 100
                )

            elif query_type == "mongodb_aggregate" and parsed.get("mongodb_pipeline"):
                pipeline = parsed["mongodb_pipeline"]
                mongodb_find = parsed.get("mongodb_find") or {}
                collection = mongodb_find.get("collection") or target
                generated_query = json.dumps(pipeline)
                raw_results, total_count = connector.execute_mongodb_aggregate(
                    collection, pipeline
                )
            exec_error = None
            break

        except Exception as e:
            exec_error = str(e)
            if attempt < 2:
                # Ask Groq to fix the query
                fix_response = groq.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": (
                            f"The following query failed with error: {exec_error}\n"
                            f"Query: {generated_query}\n"
                            f"Original question: {user_message}\n"
                            f"Fix the query and return the same JSON format."
                        )}
                    ],
                    temperature=0.0,
                    max_tokens=800,
                    response_format={"type": "json_object"}
                )
                try:
                    parsed = _extract_json(fix_response.choices[0].message.content)
                except ValueError:
                    break # Break if we can't parse the fix response

    exec_time_ms = int((time.time() - start_ts) * 1000)

    if exec_error:
        return {
            "reply": f"I generated a query but it failed to execute: {exec_error}. "
                     f"This may mean the question requires data not available in the current schema.",
            "generated_query": generated_query,
            "query_type": query_type,
            "result_row_count": 0,
            "execution_time_ms": exec_time_ms,
            "error": exec_error
        }

    # Process results based on size
    hint = parsed.get("result_handling_hint", "full")
    processed_results = result_processor.process(raw_results, total_count, hint)

    # GROQ CALL 2: Generate natural language response
    call2_messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful database assistant. "
                "Given the user's question, the query that was executed, "
                "and the query results, provide a clear, concise, "
                "natural language answer. Do not repeat the raw data unless "
                "the user specifically asked for it. Highlight key insights."
            )
        },
        *history_messages,
        {"role": "user", "content": (
            f"Question: {user_message}\n\n"
            f"Query executed ({query_type}): {generated_query}\n\n"
            f"Results: {json.dumps(processed_results, default=str)}"
        )}
    ]

    call2_response = groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=call2_messages,
        temperature=0.3,
        max_tokens=1500
    )

    reply = call2_response.choices[0].message.content.strip()

    return {
        "reply": reply,
        "generated_query": generated_query,
        "query_type": query_type,
        "result_row_count": total_count,
        "execution_time_ms": exec_time_ms,
        "error": None
    }
