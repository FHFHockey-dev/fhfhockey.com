type PlayerRow = {
  player_name: string | null;
  editorial_team_abbreviation: string | null;
  eligible_positions: string[] | null;
  draft_analysis: any | null;
  average_draft_cost: number | null;
  average_draft_pick: number | null;
  average_draft_round: number | null;
  percent_drafted: number | null;
  percent_ownership: number | null;
  status: string | null;
  status_full: string | null;
  last_updated: string | null;
  ownership_timeline: { date: string; value: number }[] | null;
};

export const HEADERS = [
  'Player Name',
  'Team',
  'Eligible Positions',
  'Avg Cost',
  'Avg Pick',
  'Avg Round',
  'Percent Drafted',
  'Preseason Avg Cost',
  'Preseason Avg Pick',
  'Preseason Avg Round',
  'Preseason Percent Drafted',
  'Percent Ownership',
  'Status',
  'Status Full',
  'Last Updated',
  'Sparkline',
  // OT_1..OT_30 helper columns appended dynamically
];

export function buildHeadersWithHelpers(points: number) {
  const base = [...HEADERS];
  for (let i = 1; i <= points; i++) base.push(`OT_${i}`);
  return base;
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapPlayersToRows(
  rows: PlayerRow[],
  helperPoints = 30
): (string | number | null)[][] {
  const out: (string | number | null)[][] = [];
  for (const r of rows) {
    const da = (r.draft_analysis || {}) as any;

    const avgCost = r.average_draft_cost ?? toNumber(da.average_cost);
    const rawAvgPick = r.average_draft_pick ?? toNumber(da.average_pick);
    const avgPick = rawAvgPick === 0 ? null : rawAvgPick; // treat 0 (not drafted) as blank so it sorts to bottom
    const avgRound = r.average_draft_round ?? toNumber(da.average_round);
    const pctDrafted = r.percent_drafted ?? toNumber(da.percent_drafted);

    const preAvgCost = toNumber(da.preseason_average_cost);
    const preAvgPick = toNumber(da.preseason_average_pick);
    const preAvgRound = toNumber(da.preseason_average_round);
    const prePctDrafted = toNumber(da.preseason_percent_drafted);

    const elig = Array.isArray(r.eligible_positions)
      ? (r.eligible_positions as string[]).sort().join(', ')
      : null;

    const timeline = Array.isArray(r.ownership_timeline)
      ? (r.ownership_timeline as { date: string; value: number }[])
      : [];

    // sort by date ascending, take last N values
    const values = timeline
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((t) => toNumber(t.value))
      .filter((v): v is number => typeof v === 'number')
      .slice(-helperPoints);

    // pad left with blanks if fewer than helperPoints
    const pad = new Array(Math.max(0, helperPoints - values.length)).fill(null);
    const helperCols = [...pad, ...values];

    const row: (string | number | null)[] = [
      r.player_name ?? null,
      r.editorial_team_abbreviation ?? null,
      elig,
      avgCost,
      avgPick,
      avgRound,
      pctDrafted,
      preAvgCost,
      preAvgPick,
      preAvgRound,
      prePctDrafted,
      r.percent_ownership ?? null,
      r.status ?? null,
      r.status_full ?? null,
      r.last_updated ?? null,
      null, // sparkline formula placeholder; to be filled by caller
      ...helperCols,
    ];
    out.push(row);
  }
  return out;
}
