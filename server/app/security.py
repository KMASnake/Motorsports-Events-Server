from fastapi import Header, HTTPException
from .config import get_settings


def require_admin_key(x_admin_key: str = Header(default="")):
    if x_admin_key != get_settings().admin_api_key:
        raise HTTPException(status_code=401, detail="Clé d'administration invalide.")


def require_public_key(x_api_key: str = Header(default="")):
    expected = get_settings().public_api_key
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Clé API invalide.")
