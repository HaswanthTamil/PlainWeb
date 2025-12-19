# Firebase Functions (TypeScript)

Quick setup for the functions in this workspace.

Install deps:

```powershell
cd backend/functions
npm install
```

Run emulators (Functions + Firestore):

```powershell
cd backend/functions
npm run serve
```

Notes:

- The Express app is exposed as an HTTPS function named `api` with an `/audit` endpoint.
- `/.env.example` shows environment variables useful for local emulation.
- The endpoint POST `/audit` accepts JSON { "url": "https://..." } or query `?url=...`.
- Audit reports are cached in Firestore collection `audits` using encoded URL as doc id.
