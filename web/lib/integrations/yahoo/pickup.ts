export type YahooPickupContext = {
  leagueName: string;
  teamName: string;
  gameKey: string;
  season: number;
  fetchedAt: string;
  rosteredPlayerKeys: string[];
  roster: { key: string; name: string; position: string | null }[];
};

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const fields = (value: unknown): Row => Array.isArray(value) ? Object.assign({}, ...value.map(fields)) : object(value);
function find(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (key in value) return (value as Row)[key];
  for (const child of Object.values(value)) {
    const result = find(child, key);
    if (result !== undefined) return result;
  }
  return undefined;
}
function collection(value: unknown, key: string): Row[] {
  const rows: Row[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (key in node) { rows.push(fields((node as Row)[key])); return; }
    Object.values(node).forEach(visit);
  };
  visit(value);
  const count = Number(object(value).count);
  if (!Number.isInteger(count) || count !== rows.length) throw new Error("Incomplete Yahoo roster response.");
  return rows;
}

/** Fail closed: missing rosters must never turn owned players into free agents. */
export function parseYahooPickupRosters(payload: unknown, leagueKey: string, teamKey: string) {
  const teams = collection(find(payload, "teams"), "team");
  if (!teams.length || !teams.some((team) => team.team_key === teamKey)) throw new Error("Selected Yahoo team is missing.");
  const seenTeams = new Set<string>();
  const rostered = new Set<string>();
  const roster: YahooPickupContext["roster"] = [];
  const gameKey = leagueKey.split(".")[0];
  for (const team of teams) {
    const key = String(team.team_key ?? "");
    if (!key.startsWith(`${leagueKey}.t.`) || seenTeams.has(key)) throw new Error("Invalid Yahoo league roster.");
    seenTeams.add(key);
    for (const player of collection(find(team.roster, "players"), "player")) {
      const playerKey = String(player.player_key ?? "");
      if (!new RegExp(`^${gameKey}\\.p\\.\\d+$`).test(playerKey) || rostered.has(playerKey)) throw new Error("Ambiguous Yahoo player identity.");
      rostered.add(playerKey);
      if (key === teamKey) roster.push({
        key: playerKey,
        name: typeof object(player.name).full === "string" ? object(player.name).full as string : playerKey,
        position: typeof fields(player.selected_position).position === "string" ? fields(player.selected_position).position as string : null,
      });
    }
  }
  return { rosteredPlayerKeys: [...rostered], roster };
}

export function isYahooPickupPlayer(playerKey: string | null, context: YahooPickupContext, view: "available" | "roster") {
  if (!playerKey) return false;
  const key = /^\d+$/.test(playerKey) ? `${context.gameKey}.p.${playerKey}` : playerKey;
  if (!key.startsWith(`${context.gameKey}.p.`)) return false;
  return view === "roster" ? context.roster.some((player) => player.key === key) : !context.rosteredPlayerKeys.includes(key);
}
