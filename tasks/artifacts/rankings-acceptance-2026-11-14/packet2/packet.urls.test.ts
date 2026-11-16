// Offline URL validation for the Rankings follow-up read packet (no network).
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  DEFAULT_RANKINGS_FILTERS, normalizeRankingsFilters, buildMatrixRequestPath,
  buildGoalieMatrixRequestPath, buildTeamMatrixRequestPath, buildTrendingRequestPath,
  buildRankingsRequestPath, buildSnapshotRequestPath,
} from "lib/rankings/rankingUrlState";
import { parsePlayerMatrixRequest } from "lib/rankings/playerMatrix";
import { parseGoalieMatrixRequest } from "lib/rankings/goalieMatrix";
import { parseTeamMatrixRequest } from "lib/rankings/teamMatrix";
import { parseTrendingRequest } from "lib/rankings/trending";
import { parseContextualRankingsRequest } from "lib/rankings/rankingTypes";

const q = (path: string) => Object.fromEntries(new URL(path, "http://x").searchParams);
const f = (o: Record<string, unknown>) => ({ ...DEFAULT_RANKINGS_FILTERS, season: "20262027", ...o } as any);
const out: Array<{ id: string; path: string }> = [];
const add = (id: string, path: string | null, parse: (query: any) => unknown) => {
  expect(path, id).toBeTruthy();
  expect(() => parse(q(path!)), id).not.toThrow();
  out.push({ id, path: path! });
};

describe("packet2 urls parse", () => {
  it("all", () => {
    add("P1-skaters-page-default", buildMatrixRequestPath(f({})), parsePlayerMatrixRequest);
    add("P2-skaters-team-EDM", buildMatrixRequestPath(f({ team: "EDM" })), (x) => parsePlayerMatrixRequest({ ...x, team: "22" }));
    add("P3-skaters-position-D", buildMatrixRequestPath(f({ position: "D" })), parsePlayerMatrixRequest);
    add("P4-snapshot-unpublished-8473533", buildSnapshotRequestPath(f({ selectedPlayerId: "8473533" })), (x) => parsePlayerMatrixRequest({ ...x, player_id: x.selected_player }));
    add("P5-goalies-current", buildGoalieMatrixRequestPath(f({ entity: "goalies" })), parseGoalieMatrixRequest);
    add("P6-goalies-2025-26", buildGoalieMatrixRequestPath(f({ entity: "goalies", season: "20252026" })), parseGoalieMatrixRequest);
    add("P7-goalie-snapshot-traded-8482076", buildSnapshotRequestPath(f({ entity: "goalies", selectedGoalieId: "8482076" })), parseGoalieMatrixRequest);
    add("P8-teams-2025-26", buildTeamMatrixRequestPath(f({ entity: "teams", season: "20252026" })), parseTeamMatrixRequest);
    add("P9-team-snapshot-EDM", buildSnapshotRequestPath(f({ entity: "teams", selectedTeam: "EDM" })), parseTeamMatrixRequest);
    add("P10-trending", buildTrendingRequestPath(f({})), parseTrendingRequest);
    add("P11-metric-explorer", buildRankingsRequestPath(f({ tab: "explorer" })) ?? buildRankingsRequestPath(f({})), parseContextualRankingsRequest);
    writeFileSync(__dirname + "/urls.json", JSON.stringify(out, null, 2));
  });
});
