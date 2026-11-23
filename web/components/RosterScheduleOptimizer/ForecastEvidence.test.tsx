import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_NOTES, overlayChangeNote,
  type RsoParticipationBasis } from "lib/projections/rsoParticipationNotes";
import type { GameForecast, LeagueRules } from "lib/rosterScheduleOptimizer/planningTypes";
import ForecastEvidence from "./ForecastEvidence";

afterEach(cleanup);
const scoring: LeagueRules["scoring"] = { mode: "points", weights: { GOALS: 3, ASSISTS: 2 }, categories: [] };
const uses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
// Fictional Detailed RSO rows in the exact form admission writes them (TJ 2026-11-21 participation policy).
const row = (playerId: string, basis: RsoParticipationBasis | null, notes: string[] = []): GameForecast => ({
  playerId, gameId: "2026020001", stats: { GOALS: basis?.endsWith("_out") ? 0 : 0.4, ASSISTS: basis?.endsWith("_out") ? 0 : 0.7 },
  conditionalStats: { GOALS: 0.4, ASSISTS: 0.7 }, conditioning: "unconditional", sourceKind: "detailed", allowedUses: uses,
  startProbability: null, confirmedStart: false, revisionId: "rev-a", issuedAt: "2026-10-10T10:00:00Z", modelVersion: "code-v1",
  cutoffAt: "2026-10-10T10:00:00Z", expiresAt: "2026-10-10T23:00:00Z",
  limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...notes, ...(basis ? [DETAILED_PARTICIPATION_NOTES[basis]] : [])] });
const names: Record<string, string> = { a: "Assumed Player", b: "Injured Player", c: "Returned Player", d: "Scratched Player", e: "Goalie Row" };
const show = (forecasts: GameForecast[]) => render(<ForecastEvidence forecasts={forecasts} scoring={scoring}
  nameOf={id => names[id]} timeZone="UTC" label="Selected lineup" />);
const article = (name: string) => screen.getByRole("article", { name: `${name} game 2026020001 GOALS evidence` });

describe("ForecastEvidence participation basis", () => {
  it("names each Detailed row's basis in plain words, once per player-game", () => {
    show([row("a", "assumed_playing"), row("b", "assumed_out"), row("c", "confirmed_playing"), row("d", "confirmed_out"), row("e", null)]);
    expect(within(article("Assumed Player")).getByText("Assumed playing")).toBeTruthy();
    expect(within(article("Injured Player")).getByText("Assumed out (injured)")).toBeTruthy();
    expect(within(article("Returned Player")).getByText("Confirmed playing")).toBeTruthy();
    expect(within(article("Scratched Player")).getByText("Confirmed out")).toBeTruthy();
    // A row without a policy basis shows none; the second target of a player-game does not repeat it.
    expect(within(article("Goalie Row")).queryByText(/^Participation:/)).toBeNull();
    expect(within(screen.getByRole("article", { name: "Assumed Player game 2026020001 ASSISTS evidence" })).queryByText(/^Participation:/)).toBeNull();
  });

  it("lists each availability change as its own line with time and source, plus the conflict flag", () => {
    const changes = [
      overlayChangeNote({ at: "2026-10-10T12:30:00Z", source: "roster event 21 (RETURN)", detail: "possible return reported; does not clear the injury" }),
      overlayChangeNote({ at: "2026-10-10T14:30:00Z", source: "accepted news fictional-return (availability:return, confirmed)", detail: "confirmed in this game's lineup" }),
      overlayChangeNote({ at: "2026-10-10T17:30:00Z", source: "roster event 31 (SCRATCH)", detail: "scratched for this game" }),
    ];
    show([row("d", "confirmed_out", [...changes, DETAILED_PARTICIPATION_CONFLICT_NOTE])]);
    const list = screen.getByRole("list", { name: "Scratched Player availability changes" });
    expect(within(list).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Oct 10, 12:30 PM UTC · roster event 21 (RETURN): possible return reported; does not clear the injury",
      "Oct 10, 2:30 PM UTC · accepted news fictional-return (availability:return, confirmed): confirmed in this game's lineup",
      "Oct 10, 5:30 PM UTC · roster event 31 (SCRATCH): scratched for this game",
    ]);
    expect(within(article("Scratched Player")).getByText(/reports for this game conflict/)).toBeTruthy();
  });
});
