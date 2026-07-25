# Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal expense tracking web app (React SPA + Express API) that stores expenses in Google Sheets via OAuth 2.0.

**Architecture:** React SPA (Vite + Tailwind + TanStack Query) on Cloudflare Pages, Express API (TypeScript) on Google Cloud Run. Users authenticate via Google OAuth 2.0, the server stores tokens in SQLite and proxies all Google Sheets API calls.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind CSS 4, TanStack Query 5, React Router v7, Express 5, better-sqlite3, googleapis

---

### Task 1: Scaffold Server Project

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`

- [ ] **Step 1: Create server package.json**

```json
{
  "name": "expense-tracker-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "express-session": "^1.18.1",
    "better-sqlite3": "^11.7.0",
    "googleapis": "^144.0.0",
    "uuid": "^11.1.0",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.1",
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create server/src/index.ts**

```typescript
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 4: Create .env.example**

```
PORT=3001
SESSION_SECRET=change-this-to-a-random-string
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback
```

- [ ] **Step 5: Install dependencies and verify**

Run in `server/`:
```bash
npm install
npx tsx src/index.ts
```

Expected: `Server running on port 3001`. Visit `http://localhost:3001/api/health` — returns `{ "status": "ok" }`. Ctrl+C to stop.

- [ ] **Step 6: Commit**

```bash
git init
git add server/
git commit -m "feat: scaffold Express server with session, CORS, health check"
```

---

### Task 2: Scaffold Client Project

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`

- [ ] **Step 1: Create client via Vite**

```bash
cd expense-tracker
npm create vite@latest client -- --template react-ts
```

This creates the whole client scaffold. Then add routing and query deps:

```bash
cd client
npm install react-router-dom @tanstack/react-query tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Vite with Tailwind**

Edit `client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

The proxy means during dev, the frontend can call `/api/expenses` and Vite forwards to the Express server. No CORS issues in dev.

- [ ] **Step 3: Add Tailwind import**

Replace `client/src/index.css` contents with:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Set up App with routing**

Replace `client/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 5: Verify dev servers**

```bash
# Terminal 1: start server
cd server && npx tsx src/index.ts

# Terminal 2: start client
cd client && npm run dev
```

Visit `http://localhost:5173` — should see blank Vite page (React logo). Ctrl+C both.

- [ ] **Step 6: Commit**

```bash
git add client/
git commit -m "feat: scaffold React client with Vite, Tailwind, React Router, TanStack Query"
```

---

### Task 3: Server — Token Store (SQLite)

**Files:**
- Create: `server/src/db.ts`

- [ ] **Step 1: Create db.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tokens.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        spreadsheet_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}

export function saveSession(
  sessionId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const db = getDb();
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  db.prepare(`
    INSERT OR REPLACE INTO sessions (session_id, access_token, refresh_token, token_expiry)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, accessToken, refreshToken, expiry);
}

export function getSession(sessionId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as {
    access_token: string;
    refresh_token: string;
    token_expiry: number;
    spreadsheet_id: string | null;
  } | undefined;
}

export function updateTokens(sessionId: string, accessToken: string, expiresIn: number) {
  const db = getDb();
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  db.prepare('UPDATE sessions SET access_token = ?, token_expiry = ? WHERE session_id = ?')
    .run(accessToken, expiry, sessionId);
}

export function updateSpreadsheetId(sessionId: string, spreadsheetId: string) {
  const db = getDb();
  db.prepare('UPDATE sessions SET spreadsheet_id = ? WHERE session_id = ?')
    .run(spreadsheetId, sessionId);
}
```

**Key learning:** SQLite is a file-based database — zero setup needed. The `data/` directory will be created automatically when the first write happens. `INSERT OR REPLACE` handles both insert and update.

- [ ] **Step 2: Ensure data directory exists**

Add this to the top of `getDb()` — replace the `mkdirSync` call:

```typescript
import fs from 'fs';
// Inside getDb, before creating the Database:
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```

So the final `getDb()` is:

```typescript
export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        spreadsheet_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}
```

- [ ] **Step 3: Verify**

```bash
npx tsx -e "const { getDb } = require('./src/db'); getDb(); console.log('DB created');"
```

Check that `server/data/tokens.db` was created. Delete it after.

- [ ] **Step 4: Commit**

```bash
git add server/src/db.ts
git commit -m "feat: add SQLite token store for user sessions"
```

---

### Task 4: Server — Google Sheets Service

**Files:**
- Create: `server/src/services/googleSheets.ts`

- [ ] **Step 1: Create googleSheets.ts**

```typescript
import { google } from 'googleapis';
import { getSession, updateTokens } from '../db';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other'];
const EXPENSES_HEADERS = ['Date', 'Item', 'Cost', 'Category', 'ID'];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) throw new Error('No session found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  // Auto-refresh if token expired
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      updateTokens(sessionId, tokens.access_token, Math.floor(tokens.expiry_date / 1000 - Date.now() / 1000));
    }
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function createExpenseSheet(sessionId: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  const session = getSession(sessionId);
  if (!session) throw new Error('No session found');

  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // Create spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Expense Tracker' },
      sheets: [
        { properties: { title: 'Expenses' } },
        { properties: { title: 'Categories' } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  // Set Expenses headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Expenses!A1:E1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [EXPENSES_HEADERS] },
  });

  // Set Categories
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Categories!A1:A' + (DEFAULT_CATEGORIES.length + 1),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: DEFAULT_CATEGORIES.map((name) => [name]) },
  });

  return spreadsheetId;
}

export async function appendExpense(
  sessionId: string,
  date: string,
  item: string,
  cost: number,
  category: string,
  id: string
) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) throw new Error('No spreadsheet found');

  await sheets.spreadsheets.values.append({
    spreadsheetId: session.spreadsheet_id,
    range: 'Expenses!A:E',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[date, item, cost, category, id]] },
  });
}

export async function getExpenses(sessionId: string, dateFilter?: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Expenses!A:E',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // Only header

  // Skip header row, map to objects
  let data = rows.slice(1).map((row: string[]) => ({
    date: row[0] || '',
    item: row[1] || '',
    cost: parseFloat(row[2]) || 0,
    category: row[3] || '',
    id: row[4] || '',
  }));

  if (dateFilter) {
    data = data.filter((e) => e.date === dateFilter);
  }

  return data.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteExpense(sessionId: string, expenseId: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) throw new Error('No spreadsheet found');

  // Read all rows to find the one to delete
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Expenses!A:E',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row: string[]) => row[4] === expenseId);
  if (rowIndex < 0) throw new Error('Expense not found');

  // Clear that row (Google Sheets API doesn't support row deletion easily)
  // We clear the contents; the empty row remains
  await sheets.spreadsheets.values.clear({
    spreadsheetId: session.spreadsheet_id,
    range: `Expenses!A${rowIndex + 1}:E${rowIndex + 1}`,
  });
}

export async function getCategories(sessionId: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) return DEFAULT_CATEGORIES;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Categories!A:A',
  });

  const rows = response.data.values || [];
  const categories = rows.flat().filter(Boolean);
  return categories.length ? categories : DEFAULT_CATEGORIES;
}

export async function addCategory(sessionId: string, name: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) throw new Error('No spreadsheet found');

  await sheets.spreadsheets.values.append({
    spreadsheetId: session.spreadsheet_id,
    range: 'Categories!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[name]] },
  });
}

export async function deleteCategory(sessionId: string, name: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = getSession(sessionId);
  if (!session?.spreadsheet_id) throw new Error('No spreadsheet found');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Categories!A:A',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row: string[]) => row[0] === name);
  if (rowIndex < 0) return;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: session.spreadsheet_id,
    range: `Categories!A${rowIndex + 1}`,
  });
}
```

- [ ] **Step 2: Verify**

```bash
npx tsx -e "const { getAuthUrl } = require('./src/services/googleSheets'); console.log(getAuthUrl());"
```

Expected: prints a Google OAuth URL starting with `https://accounts.google.com/o/oauth2/v2/auth`.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/
git commit -m "feat: add Google Sheets service with OAuth, CRUD for expenses and categories"
```

---

### Task 5: Server — Auth Middleware

**Files:**
- Create: `server/src/middleware/auth.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    sessionId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/middleware/
git commit -m "feat: add auth middleware for protected routes"
```

---

### Task 6: Server — Auth Routes

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create auth routes**

```typescript
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exchangeCode, getAuthUrl, createExpenseSheet } from '../services/googleSheets';
import { saveSession, getSession } from '../db';

const router = Router();

// Step 1: Return Google OAuth URL
router.get('/url', (_req: Request, res: Response) => {
  res.json({ url: getAuthUrl() });
});

// Step 2: OAuth callback — exchange code, create sheet, set session
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing auth code' });
    }

    const tokens = await exchangeCode(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).json({ error: 'Failed to get tokens. Ensure offline access is enabled.' });
    }

    const sessionId = uuidv4();
    saveSession(
      sessionId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    );

    // Create the spreadsheet for this user
    const spreadsheetId = await createExpenseSheet(sessionId);

    req.session.sessionId = sessionId;

    // Redirect to frontend dashboard
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Step 3: Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Step 4: Check auth status
router.get('/status', (req: Request, res: Response) => {
  if (req.session?.sessionId) {
    const session = getSession(req.session.sessionId);
    res.json({ authenticated: true, hasSpreadsheet: !!session?.spreadsheet_id });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
```

- [ ] **Step 2: Wire routes into index.ts**

Edit `server/src/index.ts` — add the imports and mount the auth routes:

```typescript
import authRoutes from './routes/auth';

// Before app.listen:
app.use('/api/auth', authRoutes);
```

- [ ] **Step 3: Test auth URL endpoint**

```bash
npx tsx src/index.ts  
# In another terminal:
curl http://localhost:3001/api/auth/url
```

Expected: `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }` Ctrl+C the server.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/auth.ts server/src/index.ts
git commit -m "feat: add OAuth routes — URL generation, callback, logout, status"
```

---

### Task 7: Server — Expenses & Categories Routes

**Files:**
- Create: `server/src/routes/expenses.ts`
- Create: `server/src/routes/categories.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create expenses routes**

```typescript
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { appendExpense, getExpenses, deleteExpense } from '../services/googleSheets';

const router = Router();

router.use(requireAuth);

// List expenses
router.get('/', async (req: Request, res: Response) => {
  try {
    const dateFilter = req.query.date as string | undefined;
    const data = await getExpenses(req.session.sessionId!, dateFilter);
    res.json(data);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Add expense
router.post('/', async (req: Request, res: Response) => {
  try {
    const { item, cost, category, date } = req.body;
    if (!item || cost === undefined || !category) {
      return res.status(400).json({ error: 'item, cost, and category are required' });
    }

    const expenseDate = date || new Date().toISOString().split('T')[0];
    const id = uuidv4();

    await appendExpense(req.session.sessionId!, expenseDate, item, cost, category, id);
    res.status(201).json({ id, date: expenseDate, item, cost, category });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Delete expense
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteExpense(req.session.sessionId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
```

- [ ] **Step 2: Create categories routes**

```typescript
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCategories, addCategory, deleteCategory } from '../services/googleSheets';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getCategories(req.session.sessionId!);
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await addCategory(req.session.sessionId!, name);
    res.status(201).json({ name });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    await deleteCategory(req.session.sessionId!, req.params.name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
```

- [ ] **Step 3: Wire routes into index.ts**

```typescript
import expenseRoutes from './routes/expenses';
import categoryRoutes from './routes/categories';

// After app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
```

- [ ] **Step 4: Verify server compiles and starts**

```bash
npx tsx src/index.ts
# Should start without errors
curl http://localhost:3001/api/expenses
# Expected: 401 { "error": "Not authenticated" }
```

Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/expenses.ts server/src/routes/categories.ts server/src/index.ts
git commit -m "feat: add expenses and categories CRUD routes"
```

---

### Task 8: Client — API Client & Types

**Files:**
- Create: `client/src/types/index.ts`
- Create: `client/src/api/client.ts`

- [ ] **Step 1: Create shared types**

```typescript
export interface Expense {
  id: string;
  date: string;
  item: string;
  cost: number;
  category: string;
}

export interface AuthStatus {
  authenticated: boolean;
  hasSpreadsheet: boolean;
}
```

- [ ] **Step 2: Create API client**

```typescript
import { Expense, AuthStatus } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  getAuthUrl: () => request<{ url: string }>('/auth/url'),
  getAuthStatus: () => request<AuthStatus>('/auth/status'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  // Expenses
  getExpenses: (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return request<Expense[]>(`/expenses${params}`);
  },
  addExpense: (data: { item: string; cost: number; category: string; date?: string }) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteExpense: (id: string) =>
    request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request<string[]>('/categories'),
  addCategory: (name: string) =>
    request<{ name: string }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteCategory: (name: string) =>
    request<{ success: boolean }>(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/types/ client/src/api/
git commit -m "feat: add API client and TypeScript types"
```

---

### Task 9: Client — Login Page

**Files:**
- Create: `client/src/pages/LoginPage.tsx`
- Create: `client/src/components/GoogleButton.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create GoogleButton component**

```tsx
interface Props {
  onClick: () => void;
  loading?: boolean;
}

export default function GoogleButton({ onClick, loading }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 cursor-pointer"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      <span className="text-sm font-medium text-gray-700">
        {loading ? 'Connecting...' : 'Connect Google Sheets'}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create LoginPage**

```tsx
import { useState } from 'react';
import { api } from '../api/client';
import GoogleButton from '../components/GoogleButton';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { url } = await api.getAuthUrl();
      window.location.href = url;
    } catch {
      setLoading(false);
      alert('Failed to connect. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="mb-6">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">$</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Tracker</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Track your daily expenses seamlessly with Google Sheets
          </p>
        </div>
        <GoogleButton onClick={handleConnect} loading={loading} />
        <p className="text-xs text-gray-400 mt-4">
          Your data is stored in your own Google Drive
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

```tsx
import LoginPage from './pages/LoginPage';

// Inside <Routes>:
<Route path="/login" element={<LoginPage />} />
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/LoginPage.tsx client/src/components/GoogleButton.tsx client/src/App.tsx
git commit -m "feat: add login page with Google OAuth button"
```

---

### Task 10: Client — Dashboard Page

**Files:**
- Create: `client/src/pages/DashboardPage.tsx`
- Create: `client/src/components/ExpenseForm.tsx`
- Create: `client/src/components/ExpenseList.tsx`

- [ ] **Step 1: Create ExpenseForm component**

```tsx
import { useState } from 'react';

interface Props {
  categories: string[];
  onAdd: (data: { item: string; cost: number; category: string }) => Promise<void>;
}

export default function ExpenseForm({ categories, onAdd }: Props) {
  const [item, setItem] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !cost || !category) return;

    setLoading(true);
    try {
      await onAdd({ item, cost: parseFloat(cost), category });
      setItem('');
      setCost('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Item</label>
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="e.g. Coffee"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cost</label>
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !item || !cost}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create ExpenseList component**

```tsx
import { Expense } from '../types';

interface Props {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const groups: Record<string, Expense[]> = {};
  for (const expense of expenses) {
    if (!groups[expense.date]) groups[expense.date] = [];
    groups[expense.date].push(expense);
  }
  return groups;
}

export default function ExpenseList({ expenses, onDelete }: Props) {
  const groups = groupByDate(expenses);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No expenses yet</p>
        <p className="text-sm mt-1">Add your first expense above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const dayTotal = groups[date].reduce((sum, e) => sum + e.cost, 0);
        return (
          <div key={date}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <span className="text-sm font-semibold text-gray-700">
                ${dayTotal.toFixed(2)}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {groups[date].map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.item}</p>
                      <p className="text-xs text-gray-400">{expense.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">${expense.cost.toFixed(2)}</span>
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create DashboardPage**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseList from '../components/ExpenseList';

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.getExpenses(),
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: api.addExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">$</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Expenses</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <ExpenseForm categories={categories} onAdd={(data) => addMutation.mutateAsync(data)} />

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <ExpenseList
            expenses={expenses}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Add route to App.tsx**

```tsx
import DashboardPage from './pages/DashboardPage';

// Replace the existing /dashboard route:
<Route path="/dashboard" element={<DashboardPage />} />
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/DashboardPage.tsx client/src/components/ExpenseForm.tsx client/src/components/ExpenseList.tsx client/src/App.tsx
git commit -m "feat: add dashboard with expense form and list"
```

---

### Task 11: Client — Categories Page

**Files:**
- Create: `client/src/pages/CategoriesPage.tsx`
- Create: `client/src/components/CategoryManager.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create CategoryManager component**

```tsx
import { useState } from 'react';

interface Props {
  categories: string[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (name: string) => void;
}

export default function CategoryManager({ categories, onAdd, onDelete }: Props) {
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    setAdding(true);
    try {
      await onAdd(newCategory.trim());
      setNewCategory('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New category name"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newCategory.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{cat}</span>
            <button
              onClick={() => onDelete(cat)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No categories yet</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CategoriesPage**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import CategoryManager from '../components/CategoryManager';

export default function CategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => api.addCategory(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteCategory(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Categories</h1>
          <div className="w-5" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <CategoryManager
            categories={categories}
            onAdd={(name) => addMutation.mutateAsync(name)}
            onDelete={(name) => deleteMutation.mutate(name)}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add route and navigation link to App.tsx**

Add the route in `App.tsx`:

```tsx
import CategoriesPage from './pages/CategoriesPage';
<Route path="/categories" element={<CategoriesPage />} />
```

Then add a nav link to the dashboard header. Edit `DashboardPage.tsx` header section — replace the "expenses count" div with:

```tsx
<button
  onClick={() => window.location.href = '/categories'}
  className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
>
  Manage Categories
</button>
```

Or better, use `useNavigate` in DashboardPage — import it and wrap:

```tsx
import { useNavigate } from 'react-router-dom';
// Inside component:
const navigate = useNavigate();
// Replace the header right section:
<button onClick={() => navigate('/categories')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
  Categories
</button>
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CategoriesPage.tsx client/src/components/CategoryManager.tsx client/src/App.tsx client/src/pages/DashboardPage.tsx
git commit -m "feat: add categories page with add/delete"
```

---

### Task 12: Add Auth Guard to Client

**Files:**
- Create: `client/src/components/AuthGuard.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create AuthGuard component**

This checks auth status on app load and redirects to login if not authenticated.

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { AuthStatus } from '../types';

interface Props {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuthStatus()
      .then((s) => {
        setStatus(s);
        if (!s.authenticated) {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        navigate('/login', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!status?.authenticated) return null;

  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap protected routes in App.tsx**

```tsx
import AuthGuard from './components/AuthGuard';

// Inside <Routes>:
<Route path="/login" element={<LoginPage />} />
<Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
<Route path="/categories" element={<AuthGuard><CategoriesPage /></AuthGuard>} />
<Route path="/" element={<Navigate to="/dashboard" replace />} />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AuthGuard.tsx client/src/App.tsx
git commit -m "feat: add auth guard to protect dashboard and categories routes"
```

---

### Task 13: Docker & Deployment — Server

**Files:**
- Create: `server/Dockerfile`
- Create: `server/.dockerignore`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY data/ ./data/

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create .dockerignore**

```
node_modules
data/
src/
tsconfig.json
```

- [ ] **Step 3: Update build script in package.json**

```json
"build": "tsc && mkdir -p data"
```

- [ ] **Step 4: Commit**

```bash
git add server/Dockerfile server/.dockerignore server/package.json
git commit -m "chore: add Dockerfile for Cloud Run deployment"
```

---

### Task 14: Deployment — Cloudflare Pages (Frontend)

**Files:**
- Create: `client/wrangler.toml`

- [ ] **Step 1: Install Wrangler CLI**

```bash
cd client
npm install --save-dev wrangler
```

- [ ] **Step 2: Create wrangler.toml**

```toml
name = "expense-tracker"
compatibility_date = "2025-12-01"

[build]
command = "npm run build"
output_dir = "dist"
```

- [ ] **Step 3: Add deploy script to client/package.json**

```json
"deploy": "npx wrangler pages deploy dist"
```

- [ ] **Step 4: Build and verify**

```bash
cd client
npm run build
npm run deploy
```

This publishes the built frontend to Cloudflare Pages at `https://expense-tracker.pages.dev`.

- [ ] **Step 5: Commit**

```bash
git add client/wrangler.toml client/package.json
git commit -m "chore: add Cloudflare Pages deployment config"
```

---

### Task 15: Environment Setup Guide

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README with setup instructions**

```markdown
# Expense Tracker

Personal expense tracking app that stores data in Google Sheets.

## Prerequisites

- Node.js 20+
- Google Cloud project with Sheets API enabled
- Cloudflare account (for frontend hosting)
- Google Cloud account (for backend hosting)

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the Google Sheets API and Google Drive API
4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/api/auth/callback` (dev)
   - Add `https://your-api-xxxx-uc.a.run.app/api/auth/callback` (production)
5. Note down the Client ID and Client Secret

## Local Development

### Server

```bash
cd server
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

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
npm run deploy
```

## Architecture

- **Frontend:** React SPA (Vite + Tailwind + TanStack Query) on Cloudflare Pages
- **Backend:** Express API on Google Cloud Run
- **Storage:** Google Sheets (via API) + SQLite (tokens)
- **Auth:** Google OAuth 2.0 with HTTP-only session cookies
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and deployment guide"
```
