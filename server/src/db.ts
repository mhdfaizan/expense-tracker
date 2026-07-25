import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tokens.db');

let db: Database.Database | null = null;

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

export function saveSession(
  sessionId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  getDb().prepare(`
    INSERT OR REPLACE INTO sessions (session_id, access_token, refresh_token, token_expiry)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, accessToken, refreshToken, expiry);
}

export function getSession(sessionId: string) {
  const row = getDb().prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as {
    access_token: string;
    refresh_token: string;
    token_expiry: number;
    spreadsheet_id: string | null;
  } | undefined;
  return row;
}

export function updateTokens(sessionId: string, accessToken: string, expiresIn: number) {
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  getDb().prepare('UPDATE sessions SET access_token = ?, token_expiry = ? WHERE session_id = ?')
    .run(accessToken, expiry, sessionId);
}

export function updateSpreadsheetId(sessionId: string, spreadsheetId: string) {
  getDb().prepare('UPDATE sessions SET spreadsheet_id = ? WHERE session_id = ?')
    .run(spreadsheetId, sessionId);
}
