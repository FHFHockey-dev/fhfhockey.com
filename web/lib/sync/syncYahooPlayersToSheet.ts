import { createClient } from '@supabase/supabase-js';
import { getSheetsAuth, getSheetId, ensureTab, clearTab, writeValues, formatSheet, colIndexToA1 } from '../google/sheets';
import { buildHeadersWithHelpers, mapPlayersToRows } from '../mappers/yahooPlayersToSheet';

export type SyncOptions = {
  tabName?: string;
  helperPoints?: number;
  gameId?: string;
};

export async function syncYahooPlayersToSheet(opts: SyncOptions = {}) {
  const tabName = opts.tabName || 'Yahoo Player Data';
  const helperPoints = typeof opts.helperPoints === 'number' ? opts.helperPoints : 30;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // If no gameId provided, try to detect current game_id/season similar to update route
  let gameId = opts.gameId;
  if (!gameId) {
    const { data: gameRow } = await supabase
      .from('yahoo_game_keys')
      .select('game_id, season')
      .eq('code', 'nhl')
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gameRow?.game_id) gameId = String(gameRow.game_id);
  }

  // Pull only the columns we need
  const selectCols = [
    'player_name',
    'editorial_team_abbreviation',
    'eligible_positions',
    'draft_analysis',
    'average_draft_cost',
    'average_draft_pick',
    'average_draft_round',
    'percent_drafted',
    'percent_ownership',
    'status',
    'status_full',
    'last_updated',
    'ownership_timeline',
    'game_id',
  ].join(', ');

  const pageSize = 1000;
  let start = 0;
  let all: any[] = [];
  while (true) {
    let page = supabase
      .from('yahoo_players')
      .select(selectCols)
      .order('player_name', { ascending: true })
      .range(start, start + pageSize - 1);
    if (gameId) page = page.eq('game_id', Number(gameId));
    const { data, error } = await page;
    if (error) throw error;
    const chunk = (data as any[]) || [];
    all = all.concat(chunk);
    if (chunk.length < pageSize) break;
    start += pageSize;
  }

  const rows = mapPlayersToRows(all, helperPoints);

  // Build headers and sparkline formulas
  const headers = buildHeadersWithHelpers(helperPoints);
  const sparkColIndex = headers.indexOf('Sparkline');
  const helperStartIndex = sparkColIndex + 1; // first helper after sparkline
  const helperEndIndex = helperStartIndex + helperPoints - 1;
  const helperStartA1 = colIndexToA1(helperStartIndex);
  const helperEndA1 = colIndexToA1(helperEndIndex);

  // Populate sparkline cell formulas per row
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-based including header, so data starts at 2
    const range = `${helperStartA1}${rowNumber}:${helperEndA1}${rowNumber}`;
    rows[i][sparkColIndex] = `=IF(COUNTA(${range})=0, "", SPARKLINE(${range}, {"charttype","line";"linewidth",1}))`;
  }

  const auth = getSheetsAuth();
  await auth.authorize();
  const spreadsheetId = getSheetId();
  const props = await ensureTab(auth, spreadsheetId, tabName);

  await clearTab(auth, spreadsheetId, tabName);
  await writeValues(auth, spreadsheetId, tabName, [headers, ...rows], true);

  await formatSheet(auth, spreadsheetId, props.sheetId!, {
    freezeHeader: true,
    hideColumnsFrom: helperStartIndex,
    hideColumnsTo: helperEndIndex,
  });

  return { count: rows.length };
}
