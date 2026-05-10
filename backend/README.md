# Backend

Express API for the encrypted password vault.

## Features

- Environment validation from `.env`
- Security middleware: Helmet, CORS, request rate limiting
- Vault setup / unlock / lock endpoints
- Encrypted password storage with AES-256-GCM
- Credential CRUD, secret reveal endpoint, legacy import endpoint
- Domain lookup endpoint for extension autofill (`GET /api/v1/credentials/domain/:domain`)

## Live URL

- Render: https://vaultgaurd-credential-manager.onrender.com
- API base: https://vaultgaurd-credential-manager.onrender.com/api/v1

## Environment

See `.env.example`.

Notable extension-related variables:

- `ALLOW_CHROME_EXTENSION_ORIGINS`
- `EXTENSION_ORIGINS`
- `BLIND_INDEX_KEY`

## Scripts

- `npm run dev`: start in watch mode
- `npm start`: start in normal mode

## API Prefix

- Base: `/api/v1`
- Health: `/api/health`
