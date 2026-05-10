# Frontend

React + Vite frontend for the password manager.

## Features

- Vault setup and unlock screens
- Dashboard UI for credential management
- Create, edit, delete, search, and filter credentials
- Password generation and strength indicator
- Reveal password on demand (via secure API endpoint)
- One-time import from legacy browser `localStorage`

## Live URL

- Vercel: https://vault-gaurd-credential-manager.vercel.app/

## Environment

Create `.env` from `.env.example`:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Scripts

- `npm run dev`: run local frontend
- `npm run build`: production build
- `npm run preview`: preview production build
