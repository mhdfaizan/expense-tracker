import { Router, Request, Response } from 'express';
import { exchangeCode, getAuthUrl, createExpenseSheet } from '../services/googleSheets';
import { saveAccount, getAccount, updateAccountSpreadsheetId, updateAccountFolderId } from '../db';

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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
      return res.redirect(`${CLIENT_URL}/login?error=access_denied`);
    }
    if (!code || typeof code !== 'string') {
      return res.redirect(`${CLIENT_URL}/login?error=missing_code`);
    }

    const { tokens, googleUserId } = await exchangeCode(code);
    if (!tokens.access_token || !tokens.refresh_token || !googleUserId) {
      console.error('Token exchange failed:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        hasIdToken: !!tokens.id_token,
        hasGoogleUserId: !!googleUserId,
      });
      return res.redirect(`${CLIENT_URL}/login?error=token_exchange_failed`);
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

    console.log('Auth callback succeeded for user:', googleUserId.substring(0, 8) + '...');
    res.redirect(`${CLIENT_URL}/dashboard`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`${CLIENT_URL}/login?error=auth_failed`);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/status', async (req: Request, res: Response) => {
  const hasSession = !!req.session?.googleUserId;
  console.log('Auth status check:', { hasSession, googleUserId: hasSession ? req.session!.googleUserId!.substring(0, 8) + '...' : null });
  if (hasSession) {
    const account = await getAccount(req.session.googleUserId!);
    console.log('Account lookup result:', { found: !!account });
    res.json({ authenticated: true, hasSpreadsheet: !!account?.spreadsheet_id });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
