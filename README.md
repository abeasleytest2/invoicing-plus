# InvoicingPlus

QuickBooks Online companion app. React + Express.

## Local dev

```
npm install
cp .env.example .env   # fill in QB credentials
npm start              # serves pre-built client from public-dist/
```

Client source lives in `client/`. To rebuild the client bundle:

```
cd client && npm install && npm run build
```

## Deploy

Configured for [Render](https://render.com) via `render.yaml`. Required env vars:

- `QB_CLIENT_ID`
- `QB_CLIENT_SECRET`
- `QB_ENVIRONMENT` (sandbox or production)
- `QB_REDIRECT_URI` (must match the value set in your Intuit app's OAuth settings)
