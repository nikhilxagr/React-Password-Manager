# React Password Manager

This repository is now organized into two primary folders:

- `frontend`: React + Vite client UI
- `backend`: Express + MongoDB API with encrypted credential storage
- `extension`: Chrome Manifest v3 autofill companion (MVP)

## Highlights

- Single-user vault with master password setup + unlock flow
- Session-based lock/unlock with inactivity timeout
- Passwords encrypted at rest using AES-256-GCM
- Credential CRUD with search, category filters, favorites, and notes
- Domain-aware credential lookup endpoint for browser autofill
- Legacy import from previous `localStorage` passwords
- Professional, responsive dashboard-style UI

## Run Locally

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

By default:

- Backend runs on `http://localhost:3000`
- Frontend runs on `http://localhost:5173`

### 3) Browser Extension (MVP)

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `extension` folder

The extension popup can unlock the vault and query domain matches for the active tab.

## Backend Extension Settings

In `backend/.env`:

- `ALLOW_CHROME_EXTENSION_ORIGINS=true` for local extension requests
- `EXTENSION_ORIGINS=` optional comma-separated explicit allowlist
- `BLIND_INDEX_KEY=` secret used to hash domain indexes

## Migration Note

If the browser still has old `localStorage` key `passwords`, the dashboard shows an import option after unlocking the new vault.
