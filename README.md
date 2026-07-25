# Expense Tracker

Personal expense tracking app that stores data in Google Sheets.

## Architecture

- **Frontend:** React SPA (Vite + Tailwind + TanStack Query) on Cloudflare Pages
- **Backend:** Express API on Google Cloud Run
- **Storage:** Google Sheets (via API) for expenses, SQLite for tokens
- **Auth:** Google OAuth 2.0 with HTTP-only session cookies

## Prerequisites

- Node.js 20+
- Google Cloud project with Sheets API + Drive API enabled
- Cloudflare account (frontend hosting)
- Google Cloud account (backend hosting)

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project, enable Google Sheets API and Google Drive API
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3001/api/auth/callback` (development)
     - `https://your-api-xxxxx-uc.a.run.app/api/auth/callback` (production)
4. Note the Client ID and Client Secret

## Local Development

### Server

```bash
cd server
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deployment

### Backend (Google Cloud Run)

```bash
cd server
npm run build
gcloud run deploy expense-tracker-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Frontend (Cloudflare Pages)

```bash
cd client
npm run build
npx wrangler pages deploy dist
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS v4, TanStack Query v5, React Router v7 |
| Backend | Express 5, TypeScript, better-sqlite3, googleapis |
| Auth | Google OAuth 2.0 (offline access) |
| Hosting | Cloudflare Pages + Google Cloud Run |
