"""FastAPI app entrypoint.

Run locally:
    uvicorn tomekeeper.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import (
    calendar,
    editions,
    flash_sales,
    forwarded_emails,
    library_entries,
    orders,
    works,
)

settings = get_settings()

app = FastAPI(title="TomeKeeper API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(works.router)
app.include_router(editions.router)
app.include_router(library_entries.router)
app.include_router(orders.router)
app.include_router(forwarded_emails.router)
app.include_router(flash_sales.router)
app.include_router(calendar.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
