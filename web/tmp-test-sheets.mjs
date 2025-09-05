import { google } from 'googleapis';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables from web/.env.local
dotenv.config({ path: '.env.local' });

async function main() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tab = 'Yahoo Player Data';

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SHEET_ID in .env.local');
  }

  console.log('Email present:', !!clientEmail, 'email:', clientEmail);
  console.log('Key present:', !!privateKey, 'length:', privateKey.length, 'hasBEGIN:', privateKey.includes('BEGIN PRIVATE KEY'));

  try {
    crypto.createPrivateKey(privateKey);
    console.log('Private key parsed OK by Node crypto');
  } catch (e) {
    console.error('Private key parse failed:', e.message);
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  await auth.authorize();

  const sheets = google.sheets('v4');

  // Write a simple header row to verify access
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: `'${tab}'!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Player Name',
        'Team',
        'Eligible Positions',
        'Sparkline'
      ]]
    }
  });

  console.log('Success: wrote headers to the sheet.');
}

main().catch((e) => {
  console.error('Failed:', e?.response?.data || e);
  process.exit(1);
});
