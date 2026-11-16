/**
 * Read-sequence comparison for the load split. Every read compares in exact order except one block: a team's
 * per-goalie input reads (evidence, workload, rest split). The writer used to load those for the model's top-ranked
 * goalie first; the loader cannot know that ranking, so it loads them in candidate order. Inside a maximal run of
 * such reads the comparison is a multiset; the run's position and every other read stay exact.
 */
type Operation = { method: string; args: unknown[] };
export type RecordedRead = { request: Operation[]; resultHash: string; failure?: string };

const GOALIE_INPUT_SELECTS = new Set(["game_date", "shots_against,goals_allowed,saves", "date,quality_start,quality_starts_pct"]);

export function isGoalieInputRead(request: Operation[]): boolean {
  const relation = String(request[0]?.args[0]);
  if (request[0]?.method !== "from" || !["forge_goalie_game", "wgo_goalie_stats"].includes(relation)) return false;
  if (!request.some((op) => op.method === "eq" && op.args[0] === "goalie_id")) return false;
  const select = String(request.find((op) => op.method === "select")?.args[0] ?? "");
  return GOALIE_INPUT_SELECTS.has(select) || select.startsWith("date,save_pct_days_rest_0");
}

export function readTokens(reads: RecordedRead[]): string[] {
  const tokens: string[] = [];
  let block: string[] = [];
  const flush = () => {
    if (block.length) tokens.push(`goalie-input-block:${JSON.stringify(block.sort())}`);
    block = [];
  };
  for (const read of reads) {
    const key = JSON.stringify([read.request, read.resultHash, read.failure ?? null]);
    if (isGoalieInputRead(read.request)) block.push(key);
    else {
      flush();
      tokens.push(key);
    }
  }
  flush();
  return tokens;
}
