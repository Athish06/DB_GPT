import os
import psycopg2
import jwt
import datetime
import bcrypt
from flask import request, jsonify
from dotenv import dotenv_values
from database_connection import connect_postgresql_from_json

# Load .env variables using dotenv_values
env = dotenv_values(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

JWT_SECRET = env.get("JWT_SECRET", "your_jwt_secret")
JWT_ALGORITHM = "HS256"

def get_db_connection():
    return psycopg2.connect(
        host=env.get("DB_HOST"),
        port=env.get("DB_PORT"),
        user=env.get("DB_USER"),
        password=env.get("DB_PASSWORD").strip("'"),
        dbname=env.get("DB_NAME"),
    )

def login_api():
    """
    JWT authentication endpoint.
    Expects JSON: { "email": "...", "password": "..." }
    Returns: { "token": "...", "user": { ... }, "databases": [ ... ] }
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Authenticate user
        cur.execute("SELECT email, password FROM auth WHERE email = %s", (email,))
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(password.encode('utf-8'), user[1].encode('utf-8')):
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid credentials"}), 401

        # Fetch all database connections for this user
        cur.execute("""
            SELECT database_name, host, user_name, password, port
            FROM database_details
            WHERE name = %s
        """, (email,))
        db_rows = cur.fetchall()
        databases = [
            {
                "database_name": row[0],
                "host": row[1],
                "user_name": row[2],
                "password": row[3],
                "port": row[4]
            }
            for row in db_rows
        ]
        cur.close()
        conn.close()

        # Check connection status for each database
        connection_statuses = []
        for db in databases:
            conn = connect_postgresql_from_json({
                "host": db["host"],
                "database": db["database_name"],
                "user": db["user_name"],
                "password": db["password"],
                "port": db["port"]
            })
            db["connection_status"] = "connected" if conn else "failed"
            if conn:
                conn.close()
            connection_statuses.append(db)

        # Generate JWT
        payload = {
            "user_id": user[0],
            "email": user[0],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return jsonify({
            "token": token,
            "user": {
                "id": user[0],
                "email": user[0]
            },
            "databases": connection_statuses
        }), 200

    except Exception as e:
        print("Login error:", e)
        return jsonify({"error": str(e)}), 500

def signup_api():
    """
    User registration endpoint.
    Expects JSON: { "email": "...", "password": "..." }
    Returns: { "status": "success" } or error.
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Check if user already exists
        cur.execute("SELECT email FROM auth WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "User already exists"}), 409

        # Insert new user
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        cur.execute("INSERT INTO auth (email, password) VALUES (%s, %s)", (email, hashed_pw.decode('utf-8')))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"}), 201
    except Exception as e:
        print("Signup error:", e)
        return jsonify({"error": str(e)}), 500