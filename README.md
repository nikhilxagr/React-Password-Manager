<div align="center">
	<img
		src="https://capsule-render.vercel.app/api?type=waving&height=200&section=header&text=VaultGuard%20Credential%20Manager&fontSize=36&fontAlignY=35&fontColor=ffffff&color=0:0f2027,50:203a43,100:2c5364&animation=twinkling"
		alt="VaultGuard Credential Manager"
	/>
	<p>
		Secure credential vault with a React + Vite dashboard, Express + MongoDB API, and a Chrome MV3 autofill companion.
	</p>
	<p>
		<img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React 19" />
		<img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square" alt="Vite 7" />
		<img src="https://img.shields.io/badge/Express-4-000000?style=flat-square" alt="Express 4" />
		<img src="https://img.shields.io/badge/MongoDB-7-47a248?style=flat-square" alt="MongoDB Driver 7" />
		<img src="https://img.shields.io/badge/Chrome_Extension-MV3-4285f4?style=flat-square" alt="Chrome MV3" />
	</p>
	<p>
		<a href="#live-urls">Live URLs</a> | <a href="#features">Features</a> | <a href="#tech-stack">Tech Stack</a> | <a href="#local-development">Local Development</a>
	</p>
</div>

## Overview

VaultGuard Credential Manager is a single-user password vault with encrypted storage, session-based unlock, and an optional browser extension for domain-aware autofill. The Chrome companion is currently named PassMongo Autofill and uses the backend domain lookup endpoints.

## Live URLs

- Frontend (Vercel): https://vault-gaurd-credential-manager.vercel.app/
- Backend (Render): https://vaultgaurd-credential-manager.onrender.com
- API base: https://vaultgaurd-credential-manager.onrender.com/api/v1

## Features

- Master password setup with unlock and lock flow
- Session TTL and inactivity timeout
- AES-256-GCM encryption for secrets at rest
- Credential CRUD with search, categories, favorites, and notes
- Domain lookup endpoint for extension autofill
- Legacy import from previous `localStorage` passwords
- Responsive, dashboard-style UI

## Tech Stack

### Frontend

- React 19 + React DOM
- Vite 7 build system
- Tailwind CSS, PostCSS, Autoprefixer
- React Toastify notifications
- ESLint 9

### Backend

- Node.js + Express 4
- MongoDB Node Driver 7
- Argon2 for key derivation and hashing
- JWT-based session tokens
- Security middleware: Helmet, CORS, Express Rate Limit
- Nodemailer for email delivery
- Morgan request logging
- tldts for domain parsing

### Browser Extension

- Chrome Extension Manifest v3
- Service worker background + content scripts
- Popup UI for unlock and suggestions

### Security Primitives

- AES-256-GCM encryption at rest
- Argon2 parameters configurable via env
- Blind index for domain matching

## Project Structure

```
backend/    Express API + vault services
frontend/   React dashboard
extension/  Chrome MV3 autofill companion
```

## Local Development

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

Defaults:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

### 3) Browser Extension (MVP)

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `extension` folder

The popup can unlock the vault and fetch domain matches for the active tab.

## Environment Variables

Backend `.env` is required. The most important keys for local dev are:

- `MONGO_URI`, `DB_NAME`, `PORT`
- `CLIENT_ORIGIN`, `APP_BASE_URL`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_EXPIRES_IN`
- `BLIND_INDEX_KEY`
- `ALLOW_CHROME_EXTENSION_ORIGINS` and optional `EXTENSION_ORIGINS`

Frontend `.env`:

- `VITE_API_BASE_URL=http://localhost:3000/api/v1`

## Notes

- Keep `ALLOW_CHROME_EXTENSION_ORIGINS=true` in backend env for local extension calls.
- Initialize the vault in the web app before using the extension.
- The dashboard surfaces a one-time import if old `localStorage` passwords are present.

## Deployment

- Backend (Render): https://vaultgaurd-credential-manager.onrender.com (config: `render.yaml`)
- Frontend (Vercel): https://vault-gaurd-credential-manager.vercel.app/ (config: `frontend/vercel.json`)
