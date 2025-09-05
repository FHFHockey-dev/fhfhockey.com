import { google } from 'googleapis';

export function getSheetsAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY');
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SHEET_ID');
  return id;
}

export async function ensureTab(auth: any, spreadsheetId: string, title: string) {
  const sheets = google.sheets('v4');
  const meta = await sheets.spreadsheets.get({ auth, spreadsheetId });
  const found = meta.data.sheets?.find((s) => s.properties?.title === title);
  if (found) return found.properties!;
  const res = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title },
          },
        },
      ],
    },
  });
  const prop = res.data.replies?.[0]?.addSheet?.properties;
  if (!prop) throw new Error('Failed to create sheet tab');
  return prop;
}

export async function clearTab(auth: any, spreadsheetId: string, title: string) {
  const sheets = google.sheets('v4');
  await sheets.spreadsheets.values.clear({
    auth,
    spreadsheetId,
    range: `'${title}'!A:ZZ`,
  });
}

export async function writeValues(
  auth: any,
  spreadsheetId: string,
  title: string,
  values: (string | number | null)[][],
  userEntered = true
) {
  const sheets = google.sheets('v4');
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: userEntered ? 'USER_ENTERED' : 'RAW',
    requestBody: { values },
  } as any);
}

export function colIndexToA1(idx: number) {
  // 0 -> A
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function formatSheet(
  auth: any,
  spreadsheetId: string,
  sheetId: number,
  options: { freezeHeader?: boolean; hideColumnsFrom?: number; hideColumnsTo?: number }
) {
  const sheets = google.sheets('v4');
  const requests: any[] = [];
  if (options.freezeHeader) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }
  if (
    typeof options.hideColumnsFrom === 'number' &&
    typeof options.hideColumnsTo === 'number' &&
    options.hideColumnsTo >= options.hideColumnsFrom
  ) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: options.hideColumnsFrom,
          endIndex: options.hideColumnsTo + 1,
        },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ auth, spreadsheetId, requestBody: { requests } });
  }
}
