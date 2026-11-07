import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForecastExplorer, { buildRevisionSpans } from "./ForecastExplorer";
import { CATEGORIES, available, unavailable, type HistoryEvent, type PublicGameView, type PublicPlayerView, type PublicRevision } from "../../lib/forge-v2/contracts";
import { DEFAULT_SCORING, scoringProfile } from "../../lib/forge-v2/identity";
import { fixtureMeans, fixtureOpportunity } from "../../lib/forge-v2/fixtures";
import { getServerSideProps } from "../../pages/forge/v2";

function revision(value: number | null, index: number): PublicRevision {
  return { id: `r${index}`, sequence: index + 1, publishedAt: new Date(Date.parse("2026-01-01T12:00:00Z") + index * 60000).toISOString(),
    inputCutoffAt: "2026-01-01T11:00:00Z", horizon: 10, teamId: index < 2 ? 1 : 2, modelVersion: index < 2 ? "fixture-model-1" : "fixture-model-2",
    trigger: "daily", evidenceClass: "fixture", value: value === null ? unavailable("missing_input") : available(value), means: fixtureMeans(),
    qualified: true,
    issuedValue: value === null ? unavailable("missing_input") : available(value), issuedProfileId: DEFAULT_SCORING.id,
    participation: available(0.8), intervals: available([{ level: 0.5, lower: 3, upper: 8 }, { level: 0.9, lower: 0, upper: 12 }]),
    intervalVintageId: `r${index}`, eligiblePregame: true, artifactState: "online", limitations: ["Synthetic fixture only"] };
}
function fixtureView(values: Array<number | null> = [10, 5, 8, 6.5]): PublicPlayerView {
  const opportunity = fixtureOpportunity();
  const revisions = values.map(revision);
  const game: PublicGameView = { opportunity, profileId: DEFAULT_SCORING.id, revisions, latestRevision: revisions.at(-1) ?? null, lockedFinalRevision: revisions.at(-1) ?? null, events: [], nextCursor: null,
    lockedFinal: { state: "selected", vintageId: `r${values.length - 1}`, value: available(6.5), lockAt: opportunity.scheduledStartAt, timingStatus: "provisional", reason: null },
    actual: { revisionId: "result-1", appearance: "official_appearance", value: available(6.5), status: "corrected" },
    freshness: { state: "fresh", asOf: "2026-01-01T12:03:00Z", reason: null },
    qualification: { state: "qualified", reason: "synthetic_display_fixture_only", supportedHorizons: [10], supportedCategories: [...CATEGORIES] } };
  return { player: { id: opportunity.playerId, name: "Synthetic Skater" }, games: [game], excluded: [{ gameId: null, reason: "affiliation_unresolved" }],
    profile: DEFAULT_SCORING, scoringLabel: "as issued", methodology: "Synthetic display fixture; no real qualification or calibration.",
    accountability: { requested: 10, forecastCount: 4, outcomeCount: 1, abstentions: 6, mae: unavailable("not_evaluated"), rmse: unavailable("not_evaluated"), bias: unavailable("not_evaluated"), evidenceClass: "fixture", limitations: ["No scientific qualification"] } };
}
const players = [{ id: 9900001, name: "Synthetic Skater" }, { id: 9900002, name: "Another Skater" }];
afterEach(cleanup);


describe("outside audit: restore default scoring",()=>{
  it("accepts the API's original-profile label after restoring default weights",async()=>{
    const initial=fixtureView(), custom=scoringProfile({...DEFAULT_SCORING.weights,G:4});
    initial.profile=custom;initial.scoringLabel="re-scored under selected profile";initial.games[0].profileId=custom.id;
    const rescore=vi.fn(async()=>fixtureView());
    render(<ForecastExplorer initialView={initial} players={players} onRescore={rescore}/>);
    fireEvent.click(screen.getByRole("button",{name:"Use default weights"}));
    fireEvent.click(screen.getByRole("button",{name:"Apply scoring"}));
    await waitFor(()=>expect(rescore).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Apply scoring"}).hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
