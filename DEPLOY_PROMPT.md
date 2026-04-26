# Claude Code prompt — push TomeKeeper to GitHub + deploy

Open Terminal, `cd ~/TomeKeeper`, then run `claude` (or `claude-code`).
Paste the block below as your first message and let it run.

---

```
I'm in ~/TomeKeeper on my Mac. This is a React+Vite PWA frontend (in `frontend/`) and a FastAPI backend (in `backend/`) that uses Supabase. I want to push it to a NEW PRIVATE GitHub repo called `TomeKeeper`, then deploy the backend to Render and the frontend to Vercel so my partner can use the app from her phone.

Important context already in the repo:
- Root `.gitignore`, `README.md`, `render.yaml`, and `frontend/vercel.json` are already written and ready.
- `backend/.gitignore` and `frontend/.gitignore` already exclude `.env` files.
- A previous session left a half-baked `.git/` directory at the project root that needs to be wiped before init.
- The backend exposes `/health` and reads CORS origins from the `ALLOWED_ORIGINS` env var.
- Supabase is already provisioned. The real secrets are in `backend/.env` (NEVER commit) and `frontend/.env.local` (NEVER commit).

Please do everything below, in order, and stop to ask me only when absolutely necessary:

## Step 1 — Sanity check + clean
- `cd ~/TomeKeeper`
- Confirm the four files above exist (.gitignore, README.md, render.yaml, frontend/vercel.json). If any are missing, stop and tell me.
- `rm -rf .git` to remove the half-baked one.
- Verify `backend/.env` and `frontend/.env.local` exist (we need their values later) but confirm they will NOT be committed by checking `git check-ignore` after init.

## Step 2 — Install + auth GitHub CLI if needed
- Check if `gh` is installed (`command -v gh`). If not, install via `brew install gh` (install Homebrew first if missing — show me the install command and pause).
- Run `gh auth status`. If not authenticated, run `gh auth login` with: GitHub.com, HTTPS, authenticate Git, login with web browser. Tell me the one-time code and pause until I confirm I authorized it.

## Step 3 — Create the repo and push
- `git init -b main`
- `git add .`
- Show me `git status` so I can verify no `.env` files are staged. If any are, STOP.
- `git commit -m "Initial commit: TomeKeeper PWA + FastAPI backend"`
- `gh repo create TomeKeeper --private --source=. --remote=origin --push`
- Print the repo URL when done.

## Step 4 — Deploy the backend to Render
- Open https://dashboard.render.com/select-repo?type=blueprint in my default browser (`open` on macOS).
- Tell me to: connect my GitHub, pick the TomeKeeper repo, and approve the blueprint Render detects from `render.yaml`.
- Then read the values from `backend/.env` and print a clean copy-paste block of every env var I need to paste into Render's prompt:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
  - For `ALLOWED_ORIGINS`, set it to `http://localhost:5173` for now — we'll add the Vercel URL after step 5.
- Wait for me to paste the Render service URL (looks like `https://tomekeeper-api.onrender.com`).

## Step 5 — Deploy the frontend to Vercel
- Open https://vercel.com/new in my browser.
- Tell me to import `TomeKeeper`, set Root Directory to `frontend`, and let Vercel detect the `vercel.json`.
- Read the values from `frontend/.env.local` and print a copy-paste block for Vercel's env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_BASE_URL` ← use the Render URL I gave you in step 4
- Wait for me to paste the Vercel URL (looks like `https://tomekeeper-xxxxx.vercel.app`).

## Step 6 — Wire CORS + finish
- Open https://dashboard.render.com/ in my browser.
- Tell me to go to tomekeeper-api → Environment, and set `ALLOWED_ORIGINS` to:
  `https://<my-vercel-url>,http://localhost:5173`
  …using the Vercel URL from step 5. Render will auto-redeploy.
- Print the final URL I should send to Janelle, plus instructions for her to "Share → Add to Home Screen" in Safari/Chrome.

## Ground rules
- Never print the contents of `.env` files in full — only the specific values needed for each deploy.
- Never `git add` `.env` or `.env.local`. If `git status` shows them staged, halt immediately.
- Don't try to install Vercel CLI or Render CLI; the dashboards are fine.
- If anything fails, show me the exact error and propose the fix — don't guess.

Begin with Step 1.
```
