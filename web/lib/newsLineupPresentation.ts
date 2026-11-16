import { normalizeNewsCategory } from "lib/newsFeed";

export type NewsLineupRow = {
  kind: "forward" | "defense" | "goalie" | "pp" | "pk" | "scratch" | "injury";
  label: string;
  players: Array<string | null>;
  group: string | null;
  partial: boolean;
  /** Per-slot source notes, e.g. "D listed at F" for a rostered defenseman the post lists in a forward row. */
  notes?: Array<string | null>;
};

export type NewsLineupPresentation = {
  rows: NewsLineupRow[];
  context: string;
  notice: string | null;
  startingGoalie: string | null;
};

/**
 * The public News lineup: the source report's interpreter units, bound to the card's team and (for game posts) the
 * snapshot's NHL game. Tiles render only from units that pass `validatedNewsLineupRows`; raw tweet text never does.
 */
export type NewsLineupSnapshot = {
  version: 1;
  binding: { teamId: number; gameId: number | null; sourceTweetId: string | null };
  interpretation: Record<string, unknown>;
};

const ROLES: Record<string, { kind: NewsLineupRow["kind"]; label: string }> = {
  es_forward: { kind: "forward", label: "F" },
  es_defense: { kind: "defense", label: "D" },
  goalie: { kind: "goalie", label: "G" },
  pp: { kind: "pp", label: "PP" },
  pk: { kind: "pk", label: "PK" },
  scratch: { kind: "scratch", label: "Scratch" },
  injury: { kind: "injury", label: "Injured" },
};

const PARTIAL_NOTICE = "Partial snapshot · Some players or roles could not be verified. See the source report.";
const UNAVAILABLE_NOTICE = "Structured lineup unavailable for this report. See the source report.";

function name(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Build the stored snapshot from a source report's retained interpretation; null when it cannot be bound. */
export function buildNewsLineupSnapshot(args: {
  interpretation: unknown; teamId: number | null; gameId: number | null; sourceTweetId: string | null;
}): NewsLineupSnapshot | null {
  const interpretation = record(args.interpretation);
  if (!interpretation || !Number.isSafeInteger(args.teamId) || !Array.isArray(interpretation.units)) return null;
  const picked = Object.fromEntries(["version", "context", "certainty", "lineContext", "rosterRevision", "units", "unresolved", "events"]
    .filter((key) => key in interpretation).map((key) => [key, interpretation[key]]));
  return { version: 1, binding: { teamId: args.teamId!, gameId: Number.isSafeInteger(args.gameId) ? args.gameId : null,
    sourceTweetId: args.sourceTweetId }, interpretation: picked };
}

/** Roster position by player id on the bound team, from the roster the interpreter resolved against. */
function rosterPositions(rosterRevision: unknown, teamId: number): Map<number, string> {
  const positions = new Map<number, string>();
  if (typeof rosterRevision !== "string") return positions;
  for (const entry of rosterRevision.split("|")) {
    const [playerId, , , team, position] = entry.split(":");
    if (Number(team) === teamId && Number.isSafeInteger(Number(playerId))) positions.set(Number(playerId), (position ?? "").toUpperCase());
  }
  return positions;
}

const FORWARD_POSITIONS = new Set(["C", "L", "R", "LW", "RW", "F"]);
const playerIdsOf = (unit: Record<string, unknown>) => (Array.isArray(unit.players) ? unit.players : []).map((player) => record(player)?.playerId);

/**
 * A forward row the interpreter held back only because a rostered defenseman is listed in it. The post reports where
 * he was listed, not where he played: accepted for News as reported, never as a roster or forecast change. The row
 * must be one resolved team D with two team forwards, the D listed in no defense pair, and the row's only flag the
 * position rejection naming exactly these players.
 */
function defenseListedAtForward(unit: Record<string, unknown>, units: Record<string, unknown>[], unresolved: Record<string, unknown>[],
  positions: Map<number, string>): Record<string, unknown> | null {
  const ids = playerIdsOf(unit);
  if (unit.situation !== "es_forward" || unit.complete !== false || ids.length !== 3 || new Set(ids).size !== 3
    || !ids.every((id) => Number.isSafeInteger(id) && positions.has(id as number))) return null;
  const roles = ids.map((id) => positions.get(id as number)!);
  // Exactly one D among rostered forwards; two would more likely be a mis-merged pair than a deployment.
  if (roles.filter((role) => role === "D").length !== 1 || !roles.every((role) => role === "D" || FORWARD_POSITIONS.has(role))) return null;
  const defensePlayers = new Set(units.filter((other) => other.situation === "es_defense").flatMap(playerIdsOf));
  if (ids.some((id, index) => roles[index] === "D" && defensePlayers.has(id))) return null;
  const flags = unresolved.filter((issue) => issue.situation === "es_forward" && (issue.number == null || issue.number === unit.number));
  const flag = flags[0];
  const candidates = Array.isArray(flag?.candidates) ? flag!.candidates : [];
  return flags.length === 1 && flag!.reason === "invalid_extraction" && candidates.length === 3
    && ids.every((id) => candidates.includes(id)) ? flag! : null;
}

/**
 * Validate a stored snapshot against the card. Units pass only when the binding names the card's team, a game post is
 * bound to an NHL game, and every player is a resolved member of that team's roster in a complete, unflagged unit.
 */
export function validatedNewsLineupRows(snapshot: unknown, teamId: number | null): {
  rows: NewsLineupRow[]; partial: boolean; startingGoalie: string | null; context: string; reported: boolean;
} | null {
  const lineup = record(snapshot);
  const binding = record(lineup?.binding);
  const interpretation = record(lineup?.interpretation);
  if (lineup?.version !== 1 || !binding || !interpretation || !Number.isSafeInteger(teamId) || binding.teamId !== teamId) return null;
  const lineContext = record(interpretation.lineContext)?.context;
  const kind = interpretation.context;
  // Game and warm-up posts need the snapshot's own NHL game; practice and camp posts have none.
  if (kind === "game" ? !Number.isSafeInteger(binding.gameId) : kind !== "practice" && kind !== "camp") return null;
  if (!Array.isArray(interpretation.units)) return null;
  const positions = rosterPositions(interpretation.rosterRevision, teamId!);
  const unresolved = Array.isArray(interpretation.unresolved) ? interpretation.unresolved.map(record).filter(Boolean) as Record<string, unknown>[] : [];
  const units = interpretation.units.map(record).filter(Boolean) as Record<string, unknown>[];
  const rows: NewsLineupRow[] = [];
  const accepted = new Set<Record<string, unknown>>();
  let rejected = false;
  for (const unit of units) {
    const role = typeof unit.situation === "string" ? ROLES[unit.situation] : null;
    const players = Array.isArray(unit.players) ? unit.players.map(record) : [];
    const resolved = role && players.length > 0 && players.every((player) => player && Number.isSafeInteger(player.playerId)
      && positions.has(player.playerId as number) && name(player.name));
    const listedAtForward = resolved ? defenseListedAtForward(unit, units, unresolved, positions) : null;
    const valid = resolved && (listedAtForward || (unit.complete === true
      && !unresolved.some((issue) => issue.situation === unit.situation && (issue.number == null || issue.number === unit.number))));
    if (!valid) { rejected = true; continue; }
    if (listedAtForward) accepted.add(listedAtForward);
    const number = Number.isSafeInteger(unit.number) && Number(unit.number) > 0 ? unit.number : "";
    rows.push({ ...role!, label: `${role!.label}${number}`, players: players.map((player) => name(player!.name)), group: name(unit.group), partial: false,
      ...(listedAtForward ? { notes: players.map((player) => positions.get(player!.playerId as number) === "D" ? "D listed at F" : null) } : {}) });
  }
  if (unresolved.some((issue) => !accepted.has(issue))) rejected = true;
  // A starter label needs an explicit goalie claim ("in goal", "starts"); order or "A | B" is not one.
  const goalieNames = new Set(rows.filter((row) => row.kind === "goalie").flatMap((row) => row.players));
  const starter = (Array.isArray(interpretation.events) ? interpretation.events : []).map(record)
    .find((event) => event?.kind === "goalie" && event.state === "confirmed" && event.goalieRole === "starter"
      && positions.has(event.playerId as number) && goalieNames.has(name(event.playerName)));
  const context = kind === "practice" ? "Practice snapshot" : kind === "camp" ? "Camp snapshot"
    : lineContext === "warmup" ? "Warm-up snapshot" : "Game snapshot";
  return { rows, partial: rejected, startingGoalie: name(starter?.playerName), context,
    // Warm-up rushes are a report of intent, never a confirmed lineup, whatever words the post uses.
    reported: lineContext === "warmup" };
}

/**
 * Display only the article's retained, validated snapshot. Never look up today's roster and never split raw text.
 * `reviewDraft` is the internal review editor's own preview of the lineup it is editing; public cards never set it.
 */
export function readNewsLineupPresentation(args: {
  metadata: Record<string, unknown> | null | undefined;
  subcategory?: string | null;
  teamId?: number | null;
  reviewDraft?: boolean;
}): NewsLineupPresentation {
  const { metadata } = args;
  const subcategory = normalizeNewsCategory(args.subcategory);
  const fallbackContext = subcategory.includes("PRACTICE") ? "Practice snapshot" : subcategory.includes("GAME") ? "Game snapshot" : "Lineup snapshot";
  if (args.reviewDraft) return readReviewDraft(metadata, fallbackContext);
  const validated = validatedNewsLineupRows(metadata?.newsLineup, args.teamId ?? null);
  if (!validated) return { rows: [], context: fallbackContext, startingGoalie: null, notice: UNAVAILABLE_NOTICE };
  const context = validated.reported ? `${validated.context} · reported` : validated.context;
  return { rows: validated.rows, context, startingGoalie: validated.startingGoalie,
    notice: !validated.rows.length ? UNAVAILABLE_NOTICE : validated.partial ? PARTIAL_NOTICE : null };
}

/** The review editor's draft card: reviewer-entered names, shown only inside the internal review page. */
function readReviewDraft(metadata: Record<string, unknown> | null | undefined, context: string): NewsLineupPresentation {
  const card = record(metadata?.lineupCard);
  const rows: NewsLineupRow[] = [];
  for (const [key, kind, prefix] of [["forwards", "forward", "F"], ["defensePairs", "defense", "D"]] as const) {
    const grid = card?.[key];
    if (!Array.isArray(grid)) continue;
    grid.forEach((raw, index) => {
      if (!Array.isArray(raw)) return;
      const players = raw.map(name);
      if (!players.some(Boolean)) return;
      rows.push({ kind, label: `${prefix}${index + 1}`, players, group: null,
        partial: players.some((player) => !player) || players.length < (kind === "forward" ? 3 : 2) });
    });
  }
  if (Array.isArray(card?.goalies)) card.goalies.forEach((player, index) => {
    const suppliedName = name(player);
    if (suppliedName) rows.push({ kind: "goalie", label: `G${index + 1}`, players: [suppliedName], group: null, partial: false });
  });
  return { rows, context, startingGoalie: name(card?.startingGoalie),
    notice: rows.some((row) => row.partial) ? "Partial snapshot · Only supplied players are shown."
      : rows.length ? null : "Structured lineup unavailable for this report." };
}
