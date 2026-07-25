import { google } from 'googleapis';
import { getAccount, updateAccountTokens, updateAccountFolderId, updateAccountSpreadsheetId } from '../db';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other'];
const EXPENSES_HEADERS = ['Date', 'Item', 'Cost', 'Category', 'ID'];

// Per-user mutex to prevent concurrent folder/sheet creation
const creationLocks = new Map<string, Promise<void>>();

async function acquireCreationLock(googleUserId: string): Promise<() => void> {
  while (creationLocks.has(googleUserId)) {
    await creationLocks.get(googleUserId);
  }
  let release: () => void;
  const lock = new Promise<void>((resolve) => { release = resolve; });
  creationLocks.set(googleUserId, lock);
  return release!;
}

function releaseCreationLock(googleUserId: string) {
  creationLocks.delete(googleUserId);
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function setupTokenRefresh(oauth2Client: InstanceType<typeof google.auth.OAuth2>, googleUserId: string) {
  oauth2Client.removeAllListeners('tokens');
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      updateAccountTokens(googleUserId, tokens.access_token, Math.floor((tokens.expiry_date - Date.now()) / 1000));
    }
  });
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

  let googleUserId: string | undefined;
  if (tokens.id_token) {
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
    googleUserId = payload.sub;
  }

  return { tokens, googleUserId };
}

export async function getAuthenticatedClient(googleUserId: string) {
  const account = await getAccount(googleUserId);
  if (!account) throw new Error('No account found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  setupTokenRefresh(oauth2Client, googleUserId);

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function createExpenseSheet(googleUserId: string): Promise<{ spreadsheetId: string; folderId: string | null }> {
  const release = await acquireCreationLock(googleUserId);
  try {
    const account = await getAccount(googleUserId);
    if (!account) throw new Error('No account found');

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });
    setupTokenRefresh(oauth2Client, googleUserId);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // If we have a stored sheet ID, verify it still exists
    if (account.spreadsheet_id) {
      try {
        await sheets.spreadsheets.get({
          spreadsheetId: account.spreadsheet_id,
          fields: 'spreadsheetId',
        });
        return { spreadsheetId: account.spreadsheet_id, folderId: account.folder_id };
      } catch (err: any) {
        // Only treat 404 as "deleted"; rethrow everything else
        if (err?.response?.status !== 404) {
          console.error('Error verifying spreadsheet:', err);
          throw err;
        }
        console.warn('Stored spreadsheet not found (deleted?), creating a new one');
        // Sheet was deleted — clear stale IDs and create fresh
        await updateAccountSpreadsheetId(googleUserId, '');
        if (account.folder_id) await updateAccountFolderId(googleUserId, '');
      }
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folder = await drive.files.create({
      requestBody: {
        name: 'Expense Tracker',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    const folderId = folder.data.id!;

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

    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: 'root',
      fields: 'id, parents',
    });

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

    return { spreadsheetId, folderId };
  } finally {
    releaseCreationLock(googleUserId);
  }
}

export async function appendExpense(
  googleUserId: string,
  date: string,
  item: string,
  cost: number,
  category: string,
  id: string
) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) throw new Error('No spreadsheet found');

  await sheets.spreadsheets.values.append({
    spreadsheetId: account.spreadsheet_id,
    range: 'Expenses!A:E',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[date, item, cost, category, id]] },
  });
}

export async function getExpenses(googleUserId: string, dateFilter?: string) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: account.spreadsheet_id,
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

export async function deleteExpense(googleUserId: string, expenseId: string) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) throw new Error('No spreadsheet found');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: account.spreadsheet_id,
    range: 'Expenses!A:E',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row: string[]) => row[4] === expenseId);
  if (rowIndex < 0) throw new Error('Expense not found');
  if (rowIndex === 0) throw new Error('Cannot delete header row');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: account.spreadsheet_id,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });
}

export async function getCategories(googleUserId: string) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) return DEFAULT_CATEGORIES;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: account.spreadsheet_id,
    range: 'Categories!A:A',
  });

  const rows = response.data.values || [];
  const categories = rows.flat().filter(Boolean);
  return categories.length ? categories : DEFAULT_CATEGORIES;
}

export async function addCategory(googleUserId: string, name: string) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) throw new Error('No spreadsheet found');

  await sheets.spreadsheets.values.append({
    spreadsheetId: account.spreadsheet_id,
    range: 'Categories!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[name]] },
  });
}

export async function deleteCategory(googleUserId: string, name: string) {
  const sheets = await getAuthenticatedClient(googleUserId);
  const account = await getAccount(googleUserId);
  if (!account?.spreadsheet_id) throw new Error('No spreadsheet found');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: account.spreadsheet_id,
    range: 'Categories!A:A',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row: string[]) => row[0] === name);
  if (rowIndex < 0) return;
  if (rowIndex === 0) throw new Error('Cannot delete header row');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: account.spreadsheet_id,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 1,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });
}
