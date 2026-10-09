# OneBox Web & Desktop

OneBox client. The same React app runs as a website (browser) and inside Electron.

## Branching

- `main` — stable, released milestones
- `feature/dev` — integration branch; every change lands here via PR from a branch cut off `feature/dev`

## Run the website locally

Start the backend first (`Onebox_Backend_BITSP`: Redis via `npm run infra:up`, then the auth service and gateway with `npm run dev`).

```bash
npm ci
npm run dev:web     # http://localhost:5173, /api is proxied to the gateway on :4000
npm test            # unit + component tests
npm run build:web   # static site in dist-web/
npm run dev         # desktop app (Electron)
```

Set `ONEBOX_API_URL` to proxy to a different gateway. In the browser the refresh token is an HttpOnly cookie and the access token is kept only in memory.
