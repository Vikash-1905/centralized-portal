# School CRM (Frontend + Backend Split)

This repository is organized into separate apps:

- `frontend/` -> Vite + React UI
- `backend/` -> Express + MongoDB API
- `docs/` -> QA and support docs

## Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas (recommended) or local MongoDB

## Install

From repository root:

```bash
npm --prefix frontend install
npm --prefix backend install
```

## Configure Backend

Create `backend/.env` and set values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/school-crm
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=12h
BCRYPT_ROUNDS=10
```

For Atlas, set `MONGO_URI` to your Atlas connection string.

## Run the App

Start backend (terminal 1):

```bash
npm --prefix backend run dev
```

Start frontend (terminal 2):

```bash
npm --prefix frontend run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

## Frontend API Base URL (Optional)

Frontend defaults to `http://localhost:5000/api`.

To override, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Phase 2 QA

Run the automated authenticated phase-2 QA suite:

```bash
npm --prefix backend run qa:phase2
```

What it checks:

- Admin settings GET/PUT/revert
- Notice create/list/delete
- Users account listing and system-user lifecycle (create, status toggle, password reset, delete)
- Class and section master lifecycle (create, delete)
- Student admission lifecycle using master class/section (create, delete)

Notes:

- The script starts backend automatically only if it is not already running.
- Temporary QA records are cleaned up at the end.
- At least one active admin account must exist.

For a manual/visual verification pass, use [docs/phase-2-qa-checklist.md](docs/phase-2-qa-checklist.md).

## First Run: Admin Setup

- On first launch, the system contains no default users or records.
- The login screen opens in Admin Setup mode.
- Create the first admin account there.
- After setup, normal role-based login is enabled.

## Data Reset

To reset data manually:

```bash
curl -X POST http://localhost:5000/api/state/reset
```
