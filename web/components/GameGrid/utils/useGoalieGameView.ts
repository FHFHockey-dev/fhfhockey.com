import { useEffect, useState } from "react";
import { z } from "zod";
import type { GameData } from "lib/NHL/types";
import type { GoalieGridSnapshot } from "./goalieGameView";
import type { GoalieWorkloadSnapshot } from "./goalieWorkloadView";
import type { GoalieWorkloadReader } from "./readGoalieSources";

export type GoalieGridReader = (request: { games: readonly GameData[]; contextKey: string }, signal: AbortSignal) => Promise<GoalieGridSnapshot>;
const text = z.string().min(1), id = z.number().int().positive(), timestamp = z.string().datetime({ offset: true });
const sourceSchema = z.object({ source: text, artifactId: text, revision: text, observedAt: timestamp.nullable(),
  availableAt: timestamp.nullable(), cutoffAt: timestamp.nullable(), issuedAt: timestamp, expiresAt: timestamp,
  basis: z.enum(["starter_observation", "model_issuance"]).optional(), freshnessBasis: text.optional() });
const metricSchema = z.object({ playerId: id, gameId: id, teamId: id, selectionRevision: text,
  target: z.enum(["official_starter", "credited_win_if_starting"]), value: z.number().finite().nullable(),
  basis: z.enum(["individual_goalie_game", "team_slot"]), source: sourceSchema, publishedAt: timestamp,
  qualification: z.object({ status: z.enum(["qualified", "unqualified"]), reportId: text.nullable(), artifactId: text,
    population: z.enum(["pregame_as_issued_goalie_game", "unknown"]) }), unavailableReason: z.string().optional() });
const snapshotSchema = z.object({ version: z.literal("goalie-grid-v1"), contextKey: text,
  requestedRange: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), through: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional(),
  boards: z.array(z.object({
  gameId: id, seasonId: id, teamId: id, opponentId: id, startsAt: timestamp, selectionRevision: text, selectedPlayerId: id.nullable(),
  candidateCoverage: z.enum(["complete", "partial", "unknown"]), candidates: z.array(z.object({ playerId: id, name: text, surname: text,
    status: z.enum(["confirmed", "projected", "unknown", "stale", "conflicting"]), source: sourceSchema,
    start: metricSchema.nullable(), winIfStarting: metricSchema.nullable() })).max(100),
})).max(320) });
export const decodeGoalieGridSnapshot = (payload: unknown): GoalieGridSnapshot => snapshotSchema.parse(payload);
export type GoaliePresentation = {
  requested?: boolean;
  workload?: { snapshot: GoalieWorkloadSnapshot | null; reader?: GoalieWorkloadReader; seasonId: number | null; selectedFrom: string; selectedThrough: string };
  enabled: boolean; contextKey: string; snapshot: GoalieGridSnapshot | null; asOf: string;
  status: "loading" | "ready" | "unavailable";
};

/** Reads admitted stored sources only; this never activates a producer or qualification gate. */
export default function useGoalieGameView(games: readonly GameData[], contextKey: string, enabled: boolean, reader?: GoalieGridReader): GoaliePresentation {
  const [state, setState] = useState<{ key: string; reader?: GoalieGridReader; snapshot: GoalieGridSnapshot | null; status: GoaliePresentation["status"] }>({ key: "", snapshot: null, status: "unavailable" });
  const [clock, setClock] = useState(0);
  const key = `${enabled}/${contextKey}`;
  useEffect(() => {
    if (!enabled || !reader) { setState({ key, reader, snapshot: null, status: "unavailable" }); return; }
    const controller = new AbortController();
    let ignore = false;
    setState({ key, reader, snapshot: null, status: "loading" });
    const timeout = setTimeout(() => { ignore = true; controller.abort(); setState({ key, reader, snapshot: null, status: "unavailable" }); }, 15_000);
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error("Obsolete goalie read.");
      return reader({ games, contextKey }, controller.signal);
    }).then(decodeGoalieGridSnapshot).then(snapshot => {
      if (!ignore) setState({ key, reader, snapshot: snapshot.contextKey === contextKey ? snapshot : null,
        status: snapshot.contextKey === contextKey ? "ready" : "unavailable" });
    }).catch(() => { if (!ignore) setState({ key, reader, snapshot: null, status: "unavailable" }); })
      .finally(() => clearTimeout(timeout));
    return () => { ignore = true; controller.abort(); clearTimeout(timeout); };
    // contextKey contains the canonical schedule identity, independent of sorting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reader]);
  const current = enabled && !!reader && state.key === key && state.reader === reader;
  const snapshot = current ? state.snapshot : null;
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const boundaries = [...games.map(g => Date.parse(g.startTimeUTC ?? "")),
      ...(snapshot?.boards.flatMap(b => b.candidates.flatMap(c => [c.source.expiresAt, c.start?.source.expiresAt, c.winIfStarting?.source.expiresAt]
        .map(t => Date.parse(t ?? "")))) ?? [])].filter(t => Number.isFinite(t) && t > now);
    const update = () => setClock(value => value + 1);
    const timer = setTimeout(update, Math.max(1, Math.min(60_000, ...boundaries.map(t => t - now))));
    const visible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", update);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, contextKey, snapshot, clock]);
  // Render-time matching hides old values before the replacement effect/request runs.
  return { enabled, contextKey, snapshot, asOf: new Date().toISOString(), status: current ? state.status : enabled && reader ? "loading" : "unavailable" };
}
