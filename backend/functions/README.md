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

Real Lighthouse runs

- Set environment variable `USE_LIGHTHOUSE=true` to attempt running real Lighthouse audits.
- Running real Lighthouse requires a Chromium binary available on the host. Locally this is usually satisfied by having Chrome installed. In hosted Cloud Functions you may need a custom runtime or container with Chromium available.
- If Lighthouse cannot be launched the function will automatically fall back to a mock response and still cache it.

Force refresh / cache

- To bypass cache and force a new audit, send `force=true` as a query parameter or `{ "force": true }` in the POST JSON body.

NOTE: The original audit implementation has been removed. The function now exposes
only a minimal health check and a placeholder `/audit` endpoint that returns 501.
Re-implement audit logic in `functions/src/index.ts` and rebuild to regenerate
`functions/lib/index.js`.
