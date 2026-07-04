import os
import sys
import jwt
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set test DB before importing app
TEST_DB = "/tmp/ironlog_test.db"
os.environ["IRONLOG_DB"] = TEST_DB

from app.main import app
from app.db.database import init_db

client = TestClient(app)

TEST_TOKEN = jwt.encode(
    {"sub": "user_test_123", "email": "test@example.com", "name": "Test User"},
    "dummy-secret",
    algorithm="HS256",
)


def setup_module(module):
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    init_db()


def teardown_module(module):
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


def auth_headers():
    return {"Authorization": f"Bearer {TEST_TOKEN}"}


def test_me_requires_auth():
    r = client.get("/me")
    assert r.status_code == 401


def test_me_returns_user():
    r = client.get("/me", headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "user_test_123"
    assert body["email"] == "test@example.com"


def test_api_keys_crud():
    r = client.post("/api-keys", json={"name": "CLI", "scopes": ["read", "write"]}, headers=auth_headers())
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "CLI"
    assert body["scopes"] == ["read", "write"]
    assert body["secret"].startswith("ilat_")
    secret = body["secret"]
    key_id = body["id"]

    r = client.get("/api-keys", headers=auth_headers())
    assert r.status_code == 200
    assert len(r.json()["_embedded"]) == 1

    r = client.get(f"/api-keys/{key_id}", headers=auth_headers())
    assert r.status_code == 200
    assert r.json()["id"] == key_id

    r = client.get("/v1/agent/dashboard", headers={"x-agent-api-key": secret})
    assert r.status_code == 200
    assert r.json()["user_id"] == "user_test_123"

    r = client.delete(f"/api-keys/{key_id}", headers=auth_headers())
    assert r.status_code == 204

    r = client.get("/v1/agent/dashboard", headers={"x-agent-api-key": secret})
    assert r.status_code == 401


def test_agent_key_missing():
    r = client.get("/v1/agent/dashboard")
    assert r.status_code == 401


def test_agent_key_invalid():
    r = client.get("/v1/agent/dashboard", headers={"x-agent-api-key": "bad"})
    assert r.status_code == 401
