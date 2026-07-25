import { Router, Request, Response } from 'express';
import { exchangeCode, getAuthUrl, createExpenseSheet } from '../services/googleSheets';
import { saveAccount, getAccount, updateAccountSpreadsheetId, updateAccountFolderId } from '../db';

const router = Router();

declare module 'express-session' {
  interface SessionData {
    googleUserId?: string;
  }
}

router.get('/url', (_req: Request, res: Response) => {
  res.json({ url: getAuthUrl() });
});

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query;
    if (oauthError) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/login?error=access_denied`);
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing auth code' });
    }

    const { tokens, googleUserId } = await exchangeCode(code);
    if (!tokens.access_token || !tokens.refresh_token || !googleUserId) {
      return res.status(400).json({ error: 'Failed to get tokens. Ensure offline access is enabled.' });
    }

    await saveAccount(
      googleUserId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    );

    const { spreadsheetId, folderId } = await createExpenseSheet(googleUserId);
    await updateAccountSpreadsheetId(googleUserId, spreadsheetId);
    if (folderId) await updateAccountFolderId(googleUserId, folderId);

    req.session.googleUserId = googleUserId;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/status', async (req: Request, res: Response) => {
  if (req.session?.googleUserId) {
    const account = await getAccount(req.session.googleUserId);
    res.json({ authenticated: true, hasSpreadsheet: !!account?.spreadsheet_id });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
