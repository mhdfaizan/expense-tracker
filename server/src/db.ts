import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tokens.db');

let SQL: SqlJsStatic;
let db: SqlJsDatabase;

function ensureDir() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function getDb(): Promise<SqlJsDatabase> {
  if (!db) {
    if (!SQL) {
      SQL = await initSqlJs();
    }
    ensureDir();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_user_id TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry INTEGER NOT NULL,
        spreadsheet_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    saveDb();
  }
  return db;
}

export async function saveAccount(
  googleUserId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const d = await getDb();
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  d.run(
    `INSERT OR REPLACE INTO accounts (google_user_id, access_token, refresh_token, token_expiry)
     VALUES (?, ?, ?, ?)`,
    [googleUserId, accessToken, refreshToken, expiry]
  );
  saveDb();
}

export async function getAccount(googleUserId: string) {
  const d = await getDb();
  const stmt = d.prepare('SELECT * FROM accounts WHERE google_user_id = ?');
  stmt.bind([googleUserId]);
  let row: Record<string, any> | undefined;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, any>;
  }
  stmt.free();
  return row as {
    access_token: string;
    refresh_token: string;
    token_expiry: number;
    spreadsheet_id: string | null;
  } | undefined;
}

export async function updateAccountTokens(googleUserId: string, accessToken: string, expiresIn: number) {
  const d = await getDb();
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  d.run('UPDATE accounts SET access_token = ?, token_expiry = ? WHERE google_user_id = ?', [accessToken, expiry, googleUserId]);
  saveDb();
}

export async function updateAccountSpreadsheetId(googleUserId: string, spreadsheetId: string) {
  const d = await getDb();
  d.run('UPDATE accounts SET spreadsheet_id = ? WHERE google_user_id = ?', [spreadsheetId, googleUserId]);
  saveDb();
}
