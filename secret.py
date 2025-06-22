import secrets

# Generate a 64-character random secret key
secret_key = secrets.token_hex(32)

print(secret_key)