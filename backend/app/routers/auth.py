from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
import sqlite3

from app.auth import require_user, create_api_key, list_api_keys, get_api_key, delete_api_key
from app.db.database import get_db
from app.models import UserOut, ApiKeyCreate, ApiKeyOut

router = APIRouter(tags=["auth"])


def _hal_embedded(items: List[Any], self_href: str) -> dict:
    return {
        "_embedded": items,
        "_links": {"self": {"href": self_href}, "collection": {"href": "/api-keys"}},
    }


@router.get("/me", response_model=UserOut)
def read_me(user: dict = Depends(require_user)):
    return {
        **user,
        "_links": {
            "self": {"href": "/me"},
            "api_keys": {"href": "/api-keys"},
        },
    }


@router.get("/api-keys")
def read_api_keys(user: dict = Depends(require_user)):
    conn = get_db()
    try:
        keys = list_api_keys(conn, user["id"])
    finally:
        conn.close()
    return _hal_embedded(keys, "/api-keys")


@router.post("/api-keys", response_model=ApiKeyOut, status_code=status.HTTP_201_CREATED)
def create_key(payload: ApiKeyCreate, user: dict = Depends(require_user)):
    conn = get_db()
    try:
        key = create_api_key(conn, user["id"], payload.model_dump())
    finally:
        conn.close()
    return key


@router.get("/api-keys/{key_id}", response_model=ApiKeyOut)
def read_key(key_id: str, user: dict = Depends(require_user)):
    conn = get_db()
    try:
        key = get_api_key(conn, user["id"], key_id)
    finally:
        conn.close()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_key(key_id: str, user: dict = Depends(require_user)):
    conn = get_db()
    try:
        ok = delete_api_key(conn, user["id"], key_id)
    finally:
        conn.close()
    if not ok:
        raise HTTPException(status_code=404, detail="API key not found")
    return None
