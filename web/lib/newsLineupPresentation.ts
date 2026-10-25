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

const ROLES: Record<string, { kind: NewsLineupRow["kind"]; label: string }> = {
  es_forward: { kind: "forward", label: "F" },
  es_defense: { kind: "defense", label: "D" },
  goalie: { kind: "goalie", label: "G" },
  pp: { kind: "pp", label: "PP" },
  pk: { kind: "pk", label: "PK" },
  scratch: { kind: "scratch", label: "Scratch" },
  injury: { kind: "injury", label: "Injured" },
};

function name(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

/** Display only the article's retained snapshot. Never look up today's roster. */
export function readNewsLineupPresentation(args: {
  metadata: Record<string, unknown> | null | undefined;
  subcategory?: string | null;
}): NewsLineupPresentation {
  const { metadata } = args;
  const interpretation = metadata?.interpretation as Record<string, unknown> | undefined;
  const subcategory = normalizeNewsCategory(args.subcategory);
  const context = interpretation?.context === "practice" ? "Practice snapshot"
    : interpretation?.context === "game" ? "Game snapshot"
    : interpretation?.context === "camp" ? "Camp snapshot"
    : subcategory.includes("PRACTICE") ? "Practice snapshot"
    : subcategory.includes("GAME") ? "Game snapshot" : "Lineup snapshot";
  const rows: NewsLineupRow[] = [];

  if (Array.isArray(interpretation?.units)) {
    for (const raw of interpretation.units) {
      if (!raw || typeof raw !== "object") continue;
      const unit = raw as Record<string, unknown>;
      const role = typeof unit.situation === "string" ? ROLES[unit.situation] : null;
      if (!role || !Array.isArray(unit.players)) continue;
      const players = unit.players.map((player) => {
        if (!player || typeof player !== "object") return null;
        return name((player as Record<string, unknown>).name);
      });
      if (!players.some(Boolean)) continue;
      const number = Number.isSafeInteger(unit.number) && Number(unit.number) > 0 ? unit.number : "";
      rows.push({ ...role, label: `${role.label}${number}`, players,
        group: name(unit.group), partial: unit.complete !== true || players.some((player) => !player) });
    }
    const unresolved = Array.isArray(interpretation.unresolved) && interpretation.unresolved.length > 0;
    const excluded = Array.isArray(interpretation.excludedUnits) && interpretation.excludedUnits.length > 0;
    return { rows, context, startingGoalie: null,
      notice: unresolved || excluded || rows.some((row) => row.partial)
        ? "Partial snapshot · Some players or roles are unresolved. See the source report."
        : rows.length ? null : "Structured lineup unavailable for this report." };
  }

  // Legacy cards encode ES roles only. Do not reinterpret a PP/PK report as F/D.
  if (/POWER PLAY|PENALTY KILL|\bPP\b|\bPK\b/.test(subcategory)) {
    return { rows, context, startingGoalie: null,
      notice: "Structured special-teams units unavailable for this report." };
  }
  const card = metadata?.lineupCard as Record<string, unknown> | undefined;
  for (const [key, kind, prefix] of [
    ["forwards", "forward", "F"], ["defensePairs", "defense", "D"],
  ] as const) {
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
  if (Array.isArray(card?.goalies)) {
    card.goalies.forEach((player, index) => {
      const suppliedName = name(player);
      if (suppliedName) rows.push({ kind: "goalie", label: `G${index + 1}`,
        players: [suppliedName], group: null, partial: false });
    });
  }
  return { rows, context, startingGoalie: name(card?.startingGoalie),
    notice: rows.some((row) => row.partial) ? "Partial snapshot · Only supplied players are shown."
      : rows.length ? null : "Structured lineup unavailable for this report." };
}
