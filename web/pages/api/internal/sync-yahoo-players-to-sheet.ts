import type { NextApiRequest, NextApiResponse } from 'next';
import { syncYahooPlayersToSheet } from '../../../lib/sync/syncYahooPlayersToSheet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Simple bearer token guard (reuse CRON_SECRET)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.toString().startsWith('Bearer ')
    ? authHeader.toString().slice('Bearer '.length)
    : '';
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const gameId = (req.query?.gameId as string) || undefined;
    const result = await syncYahooPlayersToSheet({ tabName: 'Yahoo Player Data', helperPoints: 30, gameId });
    return res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error('Sheet sync failed:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

