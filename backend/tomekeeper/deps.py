"""FastAPI dependencies: JWT validation and per-request Supabase client.

Supports both modern Supabase auth (asymmetric ES256/RS256, verified via the
project's JWKS endpoint) and legacy projects (symmetric HS256, verified with
SUPABASE_JWT_SECRET). The token's `alg` header decides which path runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from supabase import Client

from .config import get_settings
from .supabase_client import get_service_client, get_user_client


@dataclass
class CurrentUser:
    user_id: str
    email: str | None
    role: str
    jwt: str


@lru_cache(maxsize=1)
def _jwks() -> dict[str, Any]:
    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    res = httpx.get(url, timeout=10.0)
    res.raise_for_status()
    return res.json()


def _verify(token: str) -> dict[str, Any]:
    settings = get_settings()
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    # Asymmetric: pick the matching public key from JWKS by kid.
    if alg in ("ES256", "RS256", "EdDSA"):
        kid = header.get("kid")
        jwks = _jwks()
        key = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == kid), None
        )
        if key is None:
            raise JWTError(f"no JWKS key matched kid={kid!r}")
        return jwt.decode(
            token, key, algorithms=[alg], audience="authenticated"
        )

    # Legacy symmetric.
    if not settings.supabase_jwt_secret:
        raise JWTError(
            "token signed with HS256 but SUPABASE_JWT_SECRET is empty"
        )
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    # Dev escape hatch: skip JWT verification entirely. NEVER use in prod.
    if get_settings().dev_no_auth:
        return CurrentUser(
            user_id="00000000-0000-0000-0000-000000000000",
            email="dev@local",
            role="authenticated",
            jwt="",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = _verify(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject"
        )

    return CurrentUser(
        user_id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        jwt=token,
    )


def user_supabase(user: CurrentUser = Depends(current_user)) -> Client:
    """A Supabase client that hits the DB as the authenticated user (RLS applied).

    In DEV_NO_AUTH mode we use the service-role client instead so reads/writes
    succeed without a real session. RLS is BYPASSED in that mode.
    """
    if get_settings().dev_no_auth:
        return get_service_client()
    return get_user_client(user.jwt)
