import type { NextApiRequest, NextApiResponse } from "next";
import * as cheerio from "cheerio";

interface TeamRow {
  date: string | null;
  situation: string;
  [key: string]: any;
}

interface FetchResult {
  debug: Record<string, any>;
  data: TeamRow[];
}

const NECESSARY_COLUMNS = new Set([
  "Team", "GP", "TOI", "W", "L", "OTL", "Points",
  "CF", "CA", "CFPct", "FF", "FA", "FFPct",
  "SF", "SA", "SFPct", "GF", "GA", "GFPct",
  "xGF", "xGA", "xGFPct", "SCF", "SCA", "SCFPct",
  "HDCF", "HDCA", "HDCFPct", "HDSF", "HDSA", "HDSFPct",
  "HDGF", "HDGA", "HDGFPct", "SHPct", "SVPct", "PDO"
]);

function cleanHeader(header: string): string {
  return header
    .replace('/60', '_perSixty')
    .replace('/GP', '_perGame')
    .replace(/%/g, 'Pct');
}

function validatePct(value: string | null): number | null {
  if (!value || value === '-') return null;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0 || num > 100) return null;
  return num;
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; fhfhockey-bot/1.0)'
    }});
    if (!res.ok) throw new Error(`Upstream status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<FetchResult | { error: string; debug?: any }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    from_season = '20242025',
    thru_season = '20242025',
    stype = '2',
    sit = 'pk',
    score = 'all',
    rate = 'n',
    team = 'all',
    loc = 'B',
    gpf = '410',
    fd = '',
    td = ''
  } = req.query as Record<string, string>;

  if (!sit || !rate) {
    return res.status(400).json({ error: "Missing required parameters 'sit' and 'rate'" });
  }

  const url = `https://www.naturalstattrick.com/teamtable.php?fromseason=${from_season}&thruseason=${thru_season}&stype=${stype}&sit=${sit}&score=${score}&rate=${rate}&team=${team}&loc=${loc}&gpf=${gpf}&fd=${fd}&td=${td}`;

  const debug: Record<string, any> = { FetchingURL: url };

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const table = $('table#teams');
    if (!table.length) {
      debug.Error = `No table found for sit=${sit} rate=${rate}`;
      return res.status(404).json({ error: 'Table not found', debug });
    }

    const headers: string[] = [];
    table.find('thead th').each((_, el) => {
      headers.push(cleanHeader($(el).text().trim()));
    });
    debug.TableHeaders = headers;

    const rows: TeamRow[] = [];
    table.find('tbody tr').each((_, tr) => {
      const cells = $(tr).find('td');
      const row: TeamRow = { date: fd || null, situation: sit };
      headers.forEach((h, i) => {
        if (!NECESSARY_COLUMNS.has(h)) return; // skip unneeded
        const cellTextRaw = cells.eq(i).text().trim();
        const cellText = cellTextRaw === '-' ? null : cellTextRaw;
        if (h.endsWith('Pct')) {
          row[h] = cellText ? validatePct(cellText) : null;
        } else {
          row[h] = cellText;
        }
      });
      if (Object.keys(row).length > 2) rows.push(row);
    });
    debug.NumberOfRowsParsed = rows.length;

    return res.status(200).json({ debug, data: rows });
  } catch (err: any) {
    debug.Exception = err.message || String(err);
    return res.status(500).json({ error: 'Fetch failed', debug });
  }
}
