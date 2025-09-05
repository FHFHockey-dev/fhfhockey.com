import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { syncYahooPlayersToSheet } from './lib/sync/syncYahooPlayersToSheet';

async function main() {
  const gameId = process.argv[2];
  const res = await syncYahooPlayersToSheet({ tabName: 'Yahoo Player Data', helperPoints: 30, gameId });
  console.log('Sync complete:', res);
}

main().catch((e) => {
  console.error('Sync failed:', e?.response?.data || e);
  process.exit(1);
});
