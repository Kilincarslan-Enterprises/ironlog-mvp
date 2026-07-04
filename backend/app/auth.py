import os
import uuid
import secrets
import hashlib
import json
from typing import Optional, List
from datetime import datetime, timezone
import sqlite3

import jwt
from jwt import PyJWKClient
from fastapi import Request, HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.database import get_db

security = HTTPBearer(auto_error=False)

JWKS_URI = os.environ.get("CLERK_JWKS_URI")
ISSUER = os.environ.get("CLERK_ISSUER")

_jwks_client: Optional[PyJWKClient] = None

def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is None and JWKS_URI:
        _jwks_client = PyJWKClient(JWKS_URI)
    return _jwks_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_or_create_user(conn: sqlite3.Connection, user_id: str, email: Optional[str], name: Optional[str]) -> dict:
    cur = conn.cursor()
    row = cur.execute("SELECT id, email, name, role, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if row:
        return dict(row)
    cur.execute(
        "INSERT INTO users (id, email, name) VALUES (?, ?, ?)",
        (user_id, email, name),
    )
    conn.commit()
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "role": "user",
        "created_at": _now_iso(),
    }


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _generate_api_secret() -> str:
    prefix = "ilat_"
    return prefix + secrets.token_urlsafe(32)


async def require_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = credentials.credentials
    # If Clerk is not configured, accept a well-formed test/dev JWT signed with
    # any secret. This is a placeholder for Cloudflare Access or local dev.
    # If Clerk is not configured, accept a well-formed test/dev JWT signed with
    # any secret. This is a placeholder for Cloudflare Access or local dev.
    client = _get_jwks_client()
    if client:
        try:
            signing_key = client.get_signing_key_from_jwt(token)
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=ISSUER,
                options={"verify_exp": True},
            )
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    else:
        # Dev mode: decode without verification, require HS256-looking header or accept any
        try:
            decoded = jwt.decode(token, options={"verify_signature": False, "verify_exp": True})
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")

    conn = get_db()
    try:
        user = _get_or_create_user(conn, user_id, decoded.get("email"), decoded.get("name"))
    finally:
        conn.close()
    return user


def _load_key_by_secret(conn: sqlite3.Connection, secret: str) -> Optional[dict]:
    hashed = _hash_secret(secret)
    cur = conn.cursor()
    row = cur.execute(
        """
        SELECT id, user_id, name, scopes, prefix, hashed_secret, expires_at, created_at, last_used_at
        FROM api_keys WHERE hashed_secret = ?
        """,
        (hashed,),
    ).fetchone()
    if not row:
        return None
    key = dict(row)
    if key.get("expires_at") and datetime.fromisoformat(key["expires_at"]) < datetime.now(timezone.utc):
        return None
    cur.execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", (_now_iso(), key["id"]))
    conn.commit()
    return key


def require_agent_api_key(x_agent_api_key: Optional[str] = Header(None)) -> dict:
    if not x_agent_api_key:
        raise HTTPException(status_code=401, detail="Missing x-agent-api-key header")
    conn = get_db()
    try:
        key = _load_key_by_secret(conn, x_agent_api_key)
    finally:
        conn.close()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    return key


def get_current_user_from_key(key: dict = Depends(require_agent_api_key)) -> dict:
    conn = get_db()
    try:
        user = _get_or_create_user(conn, key["user_id"], None, None)
    finally:
        conn.close()
    return user


def create_api_key(conn: sqlite3.Connection, user_id: str, data: dict) -> dict:
    key_id = str(uuid.uuid4())
    plain_secret = _generate_api_secret()
    hashed = _hash_secret(plain_secret)
    prefix = plain_secret[:8]
    scopes = ",".join(data.get("scopes", ["read"]))
    expires_at = data.get("expires_at")
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO api_keys (id, user_id, name, scopes, prefix, hashed_secret, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (key_id, user_id, data["name"], scopes, prefix, hashed, expires_at),
    )
    conn.commit()
    row = cur.execute(
        "SELECT id, user_id, name, scopes, prefix, expires_at, created_at, last_used_at FROM api_keys WHERE id = ?",
        (key_id,),
    ).fetchone()
    out = dict(row)
    out["scopes"] = out["scopes"].split(",") if out["scopes"] else ["read"]
    out["secret"] = plain_secret
    out["secret_warning"] = "This secret is shown only once. Store it securely."
    return out


def list_api_keys(conn: sqlite3.Connection, user_id: str) -> List[dict]:
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT id, user_id, name, scopes, prefix, expires_at, created_at, last_used_at FROM api_keys WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["scopes"] = d["scopes"].split(",") if d["scopes"] else ["read"]
        result.append(d)
    return result


def get_api_key(conn: sqlite3.Connection, user_id: str, key_id: str) -> Optional[dict]:
    cur = conn.cursor()
    row = cur.execute(
        "SELECT id, user_id, name, scopes, prefix, expires_at, created_at, last_used_at FROM api_keys WHERE id = ? AND user_id = ?",
        (key_id, user_id),
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["scopes"] = d["scopes"].split(",") if d["scopes"] else ["read"]
    return d


def delete_api_key(conn: sqlite3.Connection, user_id: str, key_id: str) -> bool:
    cur = conn.cursor()
    cur.execute("DELETE FROM api_keys WHERE id = ? AND user_id = ?", (key_id, user_id))
    conn.commit()
    return cur.rowcount > 0
