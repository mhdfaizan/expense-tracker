# Expense Tracker - Design Document

## Overview

A personal expense tracking web app that records daily expenses (item + cost + category) and saves them to the user's Google Sheet via OAuth 2.0. Built with a separate-frontend architecture: React SPA on Vite, Express API backend, Google Sheets as the data store.

## Architecture

```
Cloudflare Pages (free static hosting)
  ┌──────────────────────────────────────┐
  │ React SPA (Vite + TypeScript)        │
  │ - Login / Onboarding                 │
  │ - Dashboard (add expense, view list) │
  │ - Category management                │
  └─────────────┬────────────────────────┘
                │ HTTPS
Google Cloud Run (free tier, always-on)
  ┌─────────────▼────────────────────────┐
  │ Express API (TypeScript)             │
  │ - OAuth token exchange / storage     │
  │ - CRUD on expenses & categories      │
  │ - SQLite for token storage           │
  │ - Google Sheets API integration      │
  └─────────────┬────────────────────────┘
                │ HTTPS
       ┌────────▼────────┐
       │ Google Sheets   │
       │ API             │
       └─────────────────┘
```

**Architecture pattern:** Backend-for-Frontend (BFF). The Express API acts as a thin server between the React frontend and Google Sheets, keeping tokens server-side and providing a clean REST interface for future mobile clients.

## Data Model

### Google Sheet: Expenses

| Column | Type | Description |
|--------|------|-------------|
| Date | string (YYYY-MM-DD) | Date of expense |
| Item | string | Description of expense |
| Cost | number | Amount spent |
| Category | string | Category name (foreign key) |
| ID | string (UUID) | Unique identifier for row |

### Google Sheet: Categories

| Column | Description |
|--------|-------------|
| Name | Category name |

**Default categories:** Food, Transport, Utilities, Entertainment, Shopping, Other

### Token Storage (server-side SQLite)

| Column | Description |
|--------|-------------|
| id | Auto-increment PK |
| session_id | Session identifier |
| access_token | Google OAuth access token |
| refresh_token | Google OAuth refresh token |
| token_expiry | Token expiry timestamp |
| spreadsheet_id | ID of the user's created spreadsheet |
| created_at | Timestamp |

## User Flows

### Onboarding
1. User visits `/login`, clicks "Connect Google Sheets"
2. Frontend calls `GET /api/auth/url`, receives Google OAuth URL
3. User redirected to Google consent screen (scopes: sheets, drive.file)
4. Google redirects to `GET /api/auth/callback?code=...`
5. Server exchanges code for tokens, stores in SQLite with session
6. Server creates "Expense Tracker" spreadsheet in user's Drive via Sheets API
7. Server populates Expenses sheet (headers) and Categories sheet (defaults)
8. Server sets HTTP-only session cookie, redirects to `/dashboard`

### Adding Expense
1. User fills form on dashboard (item, cost, category)
2. Frontend calls `POST /api/expenses` with session cookie
3. Server identifies user via session, retrieves tokens from SQLite
4. Server refreshes token if expired (using refresh_token)
5. Server appends row to Expenses sheet via Sheets API
6. Returns success response
7. Frontend invalidates query, refetches expense list

### Viewing Expenses
1. Dashboard mounts, calls `GET /api/expenses`
2. Server fetches all rows from Expenses sheet
3. Returns parsed list (excluding header row, mapping columns)
4. Displayed in table grouped by date, with delete buttons

### Managing Categories
- `GET /api/categories` — returns all category names
- `POST /api/categories { name }` — appends new category
- `DELETE /api/categories/:name` — deletes category

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/url` | No | Returns Google OAuth URL |
| GET | `/api/auth/callback?code=...` | No | OAuth callback, sets session |
| POST | `/api/auth/logout` | Yes | Clears session |
| GET | `/api/expenses?date=YYYY-MM-DD` | Yes | List expenses (optional date filter) |
| POST | `/api/expenses` | Yes | Add expense: `{ item, cost, category, date? }` |
| DELETE | `/api/expenses/:id` | Yes | Delete expense by UUID |
| GET | `/api/categories` | Yes | List categories |
| POST | `/api/categories` | Yes | Add category: `{ name }` |
| DELETE | `/api/categories/:name` | Yes | Delete category |

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | Google OAuth button |
| `/dashboard` | DashboardPage | Expense form + expense list |
| `/categories` | CategoriesPage | Add/delete categories |

### Component Tree
```
App
├── LoginPage — Google sign-in button
├── DashboardPage
│   ├── ExpenseForm — item, cost, category dropdown, date picker
│   └── ExpenseList — table grouped by date, delete per row
└── CategoriesPage
    ├── CategoryInput — text input + add button
    └── CategoryList — list with delete buttons
```

### Key Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| Frontend | React Router v7 | Client-side routing |
| Frontend | @tanstack/react-query | Server state caching + mutations |
| Frontend | Tailwind CSS | Styling |
| Backend | googleapis | Google Sheets API client |
| Backend | better-sqlite3 | Token storage (zero setup) |
| Backend | express-session | Session management |
| Backend | cors | Cross-origin requests |
| Backend | uuid | Generate UUIDs for expense rows |

## OAuth Details

- **Authorization URL:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL:** `https://oauth2.googleapis.com/token`
- **Scopes:** `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`
- **Access type:** `offline` (required for refresh token)
- **Prompt:** `consent` (ensures refresh token is always returned)
- **Redirect URI:** `https://[cloud-run-url]/api/auth/callback`

Tokens are exchanged on the server only. The frontend never sees or handles OAuth tokens. Session is maintained via HTTP-only cookies.

## Folder Structure

```
expense-tracker/
├── client/              # React SPA (Vite)
│   ├── src/
│   │   ├── pages/       # LoginPage, DashboardPage, CategoriesPage
│   │   ├── components/  # ExpenseForm, ExpenseList, CategoryManager
│   │   ├── api/         # API client functions
│   │   ├── types/       # Shared TypeScript types
│   │   └── App.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
├── server/              # Express API
│   ├── src/
│   │   ├── routes/      # auth.ts, expenses.ts, categories.ts
│   │   ├── services/    # googleSheets.ts, tokenStore.ts
│   │   ├── middleware/   # session.ts
│   │   └── index.ts
│   ├── tsconfig.json
│   └── package.json
└── README.md
```

## Hosting

| Component | Platform | Details |
|-----------|----------|---------|
| Frontend (static) | Cloudflare Pages | `npx wrangler pages deploy dist` |
| Backend (API) | Google Cloud Run | Dockerfile → `gcloud run deploy` |

Both are within Google Cloud's generous free tier and Cloudflare Pages' unlimited free bandwidth.

## Future Considerations

- **Mobile apps:** React Native (iOS/Android) consumes the same Express API
- **Database upgrade:** SQLite → Postgres when multi-user scale is needed
- **Multiple sheets:** User could create multiple expense sheets (monthly, yearly)
