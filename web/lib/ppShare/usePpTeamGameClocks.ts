import { useEffect, useState } from "react";

import { ppClockKey, type PpTeamGameClock } from "./serving";

/**
 * Client side of the decision-152 gate. "off" means PP share serving is off: the reader keeps today's behaviour.
 * "on" carries the stored clock rows, keyed by game and team. A failed request fails closed ("error"): the reader
 * withholds PP values rather than showing them ungated.
 */
export type PpClockGate =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "off" }
  | { status: "on"; clocks: Map<string, PpTeamGameClock> }
  | { status: "error"; reason: string };

export const PP_CLOCK_LOAD_FAILED_REASON = "PP data is withheld: the stored PP clock couldn't be loaded.";

export async function fetchPpClockGate(gameIds: number[]): Promise<PpClockGate> {
  if (gameIds.length === 0) return { status: "idle" };
  try {
    const response = await fetch(`/api/v1/pp-share/team-game-clock?gameIds=${gameIds.join(",")}`);
    const body = await response.json();
    if (!response.ok) return { status: "error", reason: PP_CLOCK_LOAD_FAILED_REASON };
    if (body.servingEnabled !== true) return { status: "off" };
    return {
      status: "on",
      clocks: new Map((body.clocks as PpTeamGameClock[]).map((clock) => [ppClockKey(clock.gameId, clock.teamId), clock]))
    };
  } catch {
    return { status: "error", reason: PP_CLOCK_LOAD_FAILED_REASON };
  }
}

/**
 * Loads the gate for these games while `active`; idle otherwise. Until a result for exactly these games arrives it
 * reports "loading", so a reader never renders PP values ungated in between.
 */
export function usePpTeamGameClocks(gameIds: number[], active = true): PpClockGate {
  const key = gameIds.join(",");
  const [loaded, setLoaded] = useState<{ key: string; gate: PpClockGate } | null>(null);
  useEffect(() => {
    if (!active || key === "") return;
    let mounted = true;
    fetchPpClockGate(key.split(",").map(Number)).then((gate) => {
      if (mounted) setLoaded({ key, gate });
    });
    return () => {
      mounted = false;
    };
  }, [key, active]);
  if (!active || key === "") return { status: "idle" };
  return loaded?.key === key ? loaded.gate : { status: "loading" };
}
