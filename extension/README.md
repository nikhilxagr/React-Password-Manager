# PassMongo Browser Extension (MVP)

This folder contains a Manifest v3 extension scaffold for browser autofill.

## Current capabilities

- Unlock or lock the backend vault session from popup
- Query credentials by active tab domain
- Show inline suggestions on login fields
- Fill username and password using vault secret retrieval endpoint
- Prompt to save submitted credentials back to vault

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension` folder

## Backend requirements

- Run backend on `http://localhost:3000` by default
- Keep `ALLOW_CHROME_EXTENSION_ORIGINS=true` in backend env for local development
- Ensure vault is initialized in web app before extension unlock

## Notes

- This is an implementation baseline focused on architecture and flow.
- Next iteration should replace server-side unlock with client-side key derivation for strict zero-knowledge behavior.
