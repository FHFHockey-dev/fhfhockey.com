import { normalizeNewsCategory } from "lib/newsFeed";

export type NewsLineupRow = {
  kind: "forward" | "defense" | "goalie" | "pp" | "pk" | "scratch" | "injury";
  label: string;
  players: Array<string | null>;
  group: string | null;
  partial: boolean;
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

/** Player ids on the bound team according to the roster the interpreter resolved against. */
function rosterPlayerIds(rosterRevision: unknown, teamId: number): Set<number> {
  const ids = new Set<number>();
  if (typeof rosterRevision !== "string") return ids;
  for (const entry of rosterRevision.split("|")) {
    const [playerId, , , team] = entry.split(":");
    if (Number(team) === teamId && Number.isSafeInteger(Number(playerId))) ids.add(Number(playerId));
  }
  return ids;
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
  const roster = rosterPlayerIds(interpretation.rosterRevision, teamId!);
  const unresolved = Array.isArray(interpretation.unresolved) ? interpretation.unresolved.map(record).filter(Boolean) as Record<string, unknown>[] : [];
  const rows: NewsLineupRow[] = [];
  let rejected = unresolved.length > 0;
  for (const raw of interpretation.units) {
    const unit = record(raw);
    const role = unit && typeof unit.situation === "string" ? ROLES[unit.situation] : null;
    const players = Array.isArray(unit?.players) ? unit!.players.map(record) : [];
    const valid = role && unit!.complete === true && players.length > 0
      && players.every((player) => player && Number.isSafeInteger(player.playerId) && roster.has(player.playerId as number) && name(player.name))
      && !unresolved.some((issue) => issue.situation === unit!.situation && (issue.number == null || issue.number === unit!.number));
    if (!valid) { rejected = true; continue; }
    const number = Number.isSafeInteger(unit!.number) && Number(unit!.number) > 0 ? unit!.number : "";
    rows.push({ ...role!, label: `${role!.label}${number}`, players: players.map((player) => name(player!.name)), group: name(unit!.group), partial: false });
  }
  // A starter label needs an explicit goalie claim ("in goal", "starts"); order or "A | B" is not one.
  const goalieNames = new Set(rows.filter((row) => row.kind === "goalie").flatMap((row) => row.players));
  const starter = (Array.isArray(interpretation.events) ? interpretation.events : []).map(record)
    .find((event) => event?.kind === "goalie" && event.state === "confirmed" && event.goalieRole === "starter"
      && roster.has(event.playerId as number) && goalieNames.has(name(event.playerName)));
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
