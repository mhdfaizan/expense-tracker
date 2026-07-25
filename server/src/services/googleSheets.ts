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
  const session = await getSession(sessionId);
  if (!session) throw new Error('No session found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      updateTokens(sessionId, tokens.access_token, Math.floor((tokens.expiry_date - Date.now()) / 1000));
    }
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function createExpenseSheet(sessionId: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  const session = await getSession(sessionId);
  if (!session) throw new Error('No session found');

  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // Check if user already has an Expense Tracker spreadsheet
  const existing = await drive.files.list({
    q: "name='Expense Tracker' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (existing.data.files && existing.data.files.length > 0) {
    const existingId = existing.data.files[0].id!;
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: existingId });
    const sheetNames = sheetInfo.data.sheets?.map(s => s.properties?.title) || [];
    if (sheetNames.includes('Expenses') && sheetNames.includes('Categories')) {
      return existingId;
    }
  }

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

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Expenses!A1:E1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [EXPENSES_HEADERS] },
  });

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
  const session = await getSession(sessionId);
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
  const session = await getSession(sessionId);
  if (!session?.spreadsheet_id) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Expenses!A:E',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

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
  const session = await getSession(sessionId);
  if (!session?.spreadsheet_id) throw new Error('No spreadsheet found');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: session.spreadsheet_id,
    range: 'Expenses!A:E',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row: string[]) => row[4] === expenseId);
  if (rowIndex < 0) throw new Error('Expense not found');

  await sheets.spreadsheets.values.clear({
    spreadsheetId: session.spreadsheet_id,
    range: `Expenses!A${rowIndex + 1}:E${rowIndex + 1}`,
  });
}

export async function getCategories(sessionId: string) {
  const sheets = await getAuthenticatedClient(sessionId);
  const session = await getSession(sessionId);
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
  const session = await getSession(sessionId);
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
  const session = await getSession(sessionId);
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
