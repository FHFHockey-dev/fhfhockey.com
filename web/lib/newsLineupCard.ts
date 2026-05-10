import { normalizeNewsCategory } from "lib/newsFeed";

export type NewsLineupCardData = {
  forwards: string[][];
  defensePairs: string[][];
  goalies: string[];
  startingGoalie: string | null;
};

export type NewsLineupGoalieSource = {
  sourceUrl: string | null;
  sourceLabel: string | null;
};

function cleanPlayerName(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[•·]/g, " ")
    .replace(/\s*\*+\s*$/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLinePlayers(value: string): string[] {
  return value
    .split(/\s+[-–—]\s+|[-–—]/)
    .map(cleanPlayerName)
    .filter(Boolean);
}

function isHeaderOrNoiseLine(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (/^wrapper text$/i.test(normalized)) return true;
  if (/^quoted text$/i.test(normalized)) return true;
  if (/^https?:\/\//i.test(normalized)) return true;
  if (/^pic\.twitter\.com\//i.test(normalized)) return true;
  if (/^#/.test(normalized) && !/[-–—]/.test(normalized)) return true;
  if (
    /\b(lines?|pairings?|warmups?|game\s+\d+|projected|tonight)\b/i.test(
      normalized
    ) &&
    !/[-–—]/.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function isLineupNewsCategory(
  category: string | null | undefined,
  subcategory?: string | null
): boolean {
  const normalizedCategory = normalizeNewsCategory(category);
  const normalizedSubcategory = normalizeNewsCategory(subcategory);
  return (
    normalizedCategory === "LINEUP" ||
    normalizedCategory === "LINE COMBINATION" ||
    normalizedCategory === "PRACTICE LINES" ||
    normalizedSubcategory === "LINEUP" ||
    normalizedSubcategory === "PRACTICE LINES" ||
    normalizedSubcategory === "FORWARD LINES" ||
    normalizedSubcategory === "DEFENSE PAIRS"
  );
}

export function parseLineupCardFromText(args: {
  text: string;
  category?: string | null;
  subcategory?: string | null;
}): NewsLineupCardData | null {
  if (!isLineupNewsCategory(args.category, args.subcategory)) return null;

  const forwards: string[][] = [];
  const defensePairs: string[][] = [];
  const goalies: string[] = [];
  let startingGoalie: string | null = null;

  for (const rawLine of args.text.split(/\r?\n/)) {
    const line = cleanPlayerName(rawLine);
    if (isHeaderOrNoiseLine(line)) continue;

    const players = splitLinePlayers(line);
    if (players.length >= 3 && forwards.length < 4) {
      forwards.push(players.slice(0, 3));
      continue;
    }
    if (players.length === 2 && defensePairs.length < 3) {
      defensePairs.push(players);
      continue;
    }

    if (
      players.length === 1 &&
      goalies.length < 2 &&
      !/[#@]/.test(players[0])
    ) {
      const goalieName = cleanPlayerName(
        players[0].replace(/\((starter|starting|confirmed)\)/gi, "")
      );
      if (!goalieName) continue;
      goalies.push(goalieName);
      if (!startingGoalie || /\b(starter|starting|confirmed)\b/i.test(line)) {
        startingGoalie = goalieName;
      }
    }
  }

  if (!startingGoalie) {
    startingGoalie = goalies[0] ?? null;
  }

  if (forwards.length === 0 && defensePairs.length === 0 && goalies.length === 0) {
    return null;
  }

  return {
    forwards,
    defensePairs,
    goalies,
    startingGoalie
  };
}

function normalizeNameGrid(value: unknown, maxRows: number, rowSize: number): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxRows)
    .map((row) =>
      Array.isArray(row)
        ? row.slice(0, rowSize).map((name) => cleanPlayerName(String(name ?? "")))
        : []
    )
    .filter((row) => row.some(Boolean));
}

export function readLineupCardFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): NewsLineupCardData | null {
  const rawLineup = metadata?.lineupCard;
  if (!rawLineup || typeof rawLineup !== "object") return null;
  const record = rawLineup as Record<string, unknown>;
  const forwards = normalizeNameGrid(record.forwards, 4, 3);
  const defensePairs = normalizeNameGrid(record.defensePairs, 3, 2);
  const goalies = Array.isArray(record.goalies)
    ? record.goalies.slice(0, 2).map((name) => cleanPlayerName(String(name ?? ""))).filter(Boolean)
    : [];
  const startingGoalie = cleanPlayerName(String(record.startingGoalie ?? "")) || goalies[0] || null;

  if (forwards.length === 0 && defensePairs.length === 0 && goalies.length === 0) {
    return null;
  }

  return {
    forwards,
    defensePairs,
    goalies,
    startingGoalie
  };
}
