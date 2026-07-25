import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { exchangeCode, getAuthUrl, createExpenseSheet } from '../services/googleSheets';
import { saveSession, getSession } from '../db';

const router = Router();

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

    const spreadsheetId = await createExpenseSheet(sessionId);

    req.session.sessionId = sessionId;

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

router.get('/status', (req: Request, res: Response) => {
  if (req.session?.sessionId) {
    const session = getSession(req.session.sessionId);
    res.json({ authenticated: true, hasSpreadsheet: !!session?.spreadsheet_id });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
