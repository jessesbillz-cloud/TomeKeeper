# TomeKeeper

A personal book-tracking PWA for keeping track of upcoming releases, special editions, flash sales, and a personal library — built for collectors of beautiful editions.

## Features

- Calendar view of book releases, ship dates, preorder windows, and flash sales
- Library with collapsible cards, status tracking (upcoming / ordered / shipped / owned / for sale / sold / missed), per-edition order history, and condition / price notes
- Quick capture from the calendar: add a release, a flash sale, take a photo of a cover, or scan a QR / ISBN barcode
- Dark theme tuned for reading
- Installable as a Progressive Web App on iOS and Android

## Stack

- **Frontend** — React 18 + TypeScript + Vite + Tailwind CSS, with `vite-plugin-pwa` for the installable shell and `qr-scanner` for the live barcode reader
- **Backend** — FastAPI + Pydantic on Python 3.11+
- **Database / Auth** — Supabase (Postgres + Row-Level Security + magic-link auth)

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env  # then fill in Supabase keys
python3 -m uvicorn tomekeeper.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # then fill in Supabase keys + API URL
npm run dev
```

The frontend runs on `http://localhost:5173`. Open it on your phone over your local network using your Mac's IP (e.g. `http://192.168.1.42:5173`).

## Project layout

```
TomeKeeper/
  backend/                 FastAPI app, Supabase service-role client, scripts
    tomekeeper/            Python package
    migrations/            SQL migrations
    scripts/               Bootstrap and seed scripts
  frontend/                Vite + React PWA
    src/
      pages/               Home (calendar), Library, Capture, FlashSales, EditionDetail
      components/          Layout, AuthGate, Login, PhotoCaptureButton, QRScanButton
      lib/                 api client, types, supabase client
```
