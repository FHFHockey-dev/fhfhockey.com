import { isNewsRelayAccount, sanitizePublicNewsText } from "lib/newsFeed";
import type { TweetInterpretation, TweetUnit } from "./tweetInterpretation";

export type ProjectionReport = {
  key: string;
  teamId: number;
  teamAbbreviation: string;
  gameId: number | null;
  session: string | null;
  date: string;
  publishedAt: string | null;
  originalPublishedAt: string | null;
  receivedAt: string;
  interpretedAt?: string;
  originalUrl: string | null;
  text: string;
  interpretation: TweetInterpretation;
  provenance?: { relayTweetId: string | null; originalTweetId: string | null; attributionStatus: "resolved" | "pending" };
};
export type ProjectedUnitSet = {
  key: string;
  situation: "es" | "pp" | "pk";
  group: string | null;
  units: TweetUnit[];
  reports: ProjectionReport[];
  publishedAt: string;
};

export function verifiedOriginalTweetUrl(url: string | null, originalHandle?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^(?:www\.)?(?:x|twitter)\.com$/.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/([A-Za-z0-9_]+)\/(?:web\/)?status\/(\d+)$/);
    if (!match || isNewsRelayAccount(match[1])) return null;
    const handle = match[1] === "i" ? originalHandle : match[1];
    if (!handle || handle === "i" || isNewsRelayAccount(handle) || !/^[A-Za-z0-9_]+$/.test(handle)) return null;
    return `https://x.com/${handle}/status/${match[2]}`;
  } catch { return null; }
}

export function easternReportDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

/** A calendar date alone is deliberately insufficient to pair practice reports. */
export function explicitPracticeSession(text: string): string | null {
  const session = text.match(/\b(morning skate|morning practice|afternoon practice|evening practice|camp day\s*\d+|day\s*\d+\s+of camp)\b/i)?.[0];
  return session?.toLowerCase().replace(/\s+/g, " ") ?? null;
}

function scope(report: ProjectionReport, group: string | null): string {
  return [report.teamId, report.date, report.gameId != null ? `game:${report.gameId}` : report.session ?? `report:${report.key}`, group ?? "main"].join(":");
}

function validUnit(unit: TweetUnit) {
  const expected = unit.situation === "pp" ? 5 : unit.situation === "pk" ? 4 : unit.situation === "es_forward" ? 3 : unit.situation === "es_defense" ? 2 : 1;
  return unit.complete && unit.players.length === expected && unit.players.every((player) => Number.isSafeInteger(player.playerId) && player.playerId > 0)
    && new Set(unit.players.map((player) => player.playerId)).size === expected;
}

export function selectProjectedUnitSets(reports: ProjectionReport[]): ProjectedUnitSet[] {
  const sets: ProjectedUnitSet[] = [];
  const usable = reports.filter((report) => report.publishedAt && Number.isFinite(Date.parse(report.publishedAt)) && easternReportDate(report.publishedAt) === report.date);
  for (const report of usable) {
    for (const group of new Set(report.interpretation.units.map((unit) => unit.group))) {
      const units = report.interpretation.units.filter((unit) => unit.group === group && validUnit(unit));
      const forwards = units.filter((unit) => unit.situation === "es_forward");
      const defense = units.filter((unit) => unit.situation === "es_defense");
      const es = [...forwards, ...defense];
      if (forwards.length === 4 && defense.length === 3 && new Set(es.flatMap((unit) => unit.players.map((player) => player.playerId))).size === 18) {
        sets.push({ key: `${scope(report, group)}:es`, situation: "es", group, units: es, reports: [report], publishedAt: report.publishedAt! });
      }
      for (const situation of ["pp", "pk"] as const) {
        const own = units.filter((unit) => unit.situation === situation);
        if (own.length === 2 && own.some((unit) => unit.number === 1) && own.some((unit) => unit.number === 2)) {
          sets.push({ key: `${scope(report, group)}:${situation}`, situation, group, units: own, reports: [report], publishedAt: report.publishedAt! });
          continue;
        }
        if (own.length !== 1 || !own[0]!.explicitNumber || ![1, 2].includes(own[0]!.number ?? 0) || (report.gameId == null && !report.session) || !report.originalPublishedAt) continue;
        const candidates = usable.filter((other) => other.key !== report.key && scope(other, group) === scope(report, group)
          && other.originalPublishedAt && Number.isFinite(Date.parse(other.originalPublishedAt)) && Number.isFinite(Date.parse(report.originalPublishedAt!))
          && easternReportDate(other.originalPublishedAt) === other.date && easternReportDate(report.originalPublishedAt!) === report.date
          && Math.abs(Date.parse(other.originalPublishedAt) - Date.parse(report.originalPublishedAt!)) <= 90 * 60_000);
        const contributions = candidates.flatMap((other) => other.interpretation.units.filter((unit) => unit.situation === situation && unit.group === group && unit.explicitNumber && validUnit(unit)).map((unit) => ({ other, unit })));
        // Do not choose a convenient companion from contradictory reports of either unit.
        const signatures = new Map<number, Set<string>>();
        for (const unit of [own[0]!, ...contributions.map((entry) => entry.unit)]) {
          const signaturesForNumber = signatures.get(unit.number!) ?? new Set<string>();
          signaturesForNumber.add(unit.players.map((player) => player.playerId).sort((a, b) => a - b).join(","));
          signatures.set(unit.number!, signaturesForNumber);
        }
        if ([...signatures.values()].some((values) => values.size > 1)) continue;
        const companion = contributions.filter(({ unit }) => unit.number === (own[0]!.number === 1 ? 2 : 1)).sort((a, b) => Date.parse(b.other.publishedAt!) - Date.parse(a.other.publishedAt!))[0];
        if (!companion) continue;
        sets.push({ key: `${scope(report, group)}:${situation}`, situation, group, units: [own[0]!, companion.unit].sort((a, b) => a.number! - b.number!),
          reports: [report, companion.other], publishedAt: new Date(Math.max(Date.parse(report.publishedAt!), Date.parse(companion.other.publishedAt!))).toISOString() });
      }
    }
  }
  const latest = new Map<string, ProjectedUnitSet>();
  for (const set of sets.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.reports[0]!.key.localeCompare(b.reports[0]!.key))) if (!latest.has(set.key)) latest.set(set.key, set);
  return [...latest.values()];
}

export function publicProjectionReport(report: ProjectionReport): ProjectionReport {
  return { ...report, provenance: undefined, text: report.text.split("\n").map((line) => sanitizePublicNewsText(line)).join("\n"), originalUrl: verifiedOriginalTweetUrl(report.originalUrl),
    interpretation: { ...report.interpretation, rosterRevision: undefined, unresolved: [],
      units: report.interpretation.units.map((unit) => ({ ...unit, evidence: [] })),
      events: report.interpretation.events?.map((event) => ({ ...event, evidence: { ...event.evidence, text: sanitizePublicNewsText(event.evidence.text) } })),
    },
  };
}
