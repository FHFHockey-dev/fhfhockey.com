import { describe, expect, it } from "vitest";

import { candidateConfidence, findTeamConflicts, rankBeatReporterCandidates, rowAuthor, type BeatEvidenceRow } from "./beatReporterInference";
import type { BeatReporterReview } from "./beatReporters";

function row(overrides: Partial<BeatEvidenceRow>): BeatEvidenceRow {
  return {
    source_handle: null, source_url: null, tweet_url: null, tweet_id: null, quoted_tweet_id: null, quoted_tweet_url: null,
    quoted_author_handle: null, quoted_author_name: null, author_name: null, primary_text_source: null, raw_text: "Lines tonight",
    enriched_text: null, team_abbreviation: null, classification: "lineup", snapshot_date: "2026-11-01", provider: null, fx: null,
    quote: null, provenance: null, ifttt_account: null, ...overrides
  };
}
const posts = (handle: string, team: string | null, count: number, extra: Partial<BeatEvidenceRow> = {}) =>
  Array.from({ length: count }, (_, index) => row({ source_handle: handle, team_abbreviation: team, tweet_url: `https://x.com/${handle}/status/${index + 1}`, ...extra }));

describe("rowAuthor", () => {
  it("credits the original author of a relay retweet, not the relay", () => {
    expect(rowAuthor(row({ source_handle: "DFOFantasy", raw_text: "RT @Stefen_Rosner: Islanders lines" }))).toBe("stefen_rosner");
  });
  it("uses the FxTwitter author when present", () => {
    expect(rowAuthor(row({ source_handle: "GameDayLines", provider: "fxtwitter", fx: { author: { screen_name: "DavidAlter" }, reposted_by: { screen_name: "GameDayLines" } } }))).toBe("davidalter");
  });
});

describe("rankBeatReporterCandidates", () => {
  it("ranks a focused, high-volume author above a scattered or low-volume one", () => {
    const ranked = rankBeatReporterCandidates([
      ...posts("focused", "NYI", 30),
      ...posts("scattered", "TOR", 10), ...posts("scattered", "MTL", 10), ...posts("scattered", "OTT", 10),
      ...posts("rare", "SJS", 2)
    ]);
    expect(ranked.map((candidate) => candidate.handle)).toEqual(["focused", "scattered", "rare"]);
    expect(ranked[0]).toMatchObject({ postCount: 30, suggestedTeams: ["NYI"], confidence: 1 });
  });

  it("suggests a second team only with a real share and at least three posts", () => {
    const [candidate] = rankBeatReporterCandidates([...posts("two", "NYR", 9), ...posts("two", "NYI", 4), ...posts("two", "BOS", 1)]);
    expect(candidate.suggestedTeams).toEqual(["NYR", "NYI"]);
    expect(candidate.teams.map((team) => team.teamAbbrev)).toEqual(["NYR", "NYI", "BOS"]);
  });

  it("counts untagged posts but leaves them out of team shares", () => {
    const [candidate] = rankBeatReporterCandidates([...posts("mixed", "CAR", 6), ...posts("mixed", null, 4)]);
    expect(candidate).toMatchObject({ postCount: 10, teams: [{ teamAbbrev: "CAR", count: 6, share: 1 }] });
  });

  it("drops relays, club accounts, FHFHockey and already-reviewed handles", () => {
    const ranked = rankBeatReporterCandidates([
      ...posts("dfofantasy", "CHI", 5), ...posts("NHLFlyers", "PHI", 5), ...posts("fhfhockey", "TOR", 5),
      ...posts("reviewed", "DAL", 5), ...posts("fresh", "DAL", 5)
    ], ["Reviewed"]);
    expect(ranked.map((candidate) => candidate.handle)).toEqual(["fresh"]);
  });

  it("leaves out authors below minPosts", () => {
    const ranked = rankBeatReporterCandidates([...posts("many", "EDM", 3), ...posts("few", "EDM", 2)], [], { minPosts: 3 });
    expect(ranked.map((candidate) => candidate.handle)).toEqual(["many"]);
  });

  it("samples the suggested team's newest posts first", () => {
    const [candidate] = rankBeatReporterCandidates([
      row({ source_handle: "s", team_abbreviation: "BUF", snapshot_date: "2026-10-01", raw_text: "old BUF" }),
      row({ source_handle: "s", team_abbreviation: "FLA", snapshot_date: "2026-11-05", raw_text: "FLA" }),
      row({ source_handle: "s", team_abbreviation: "BUF", snapshot_date: "2026-11-04", raw_text: "new BUF" }),
      row({ source_handle: "s", team_abbreviation: "BUF", snapshot_date: "2026-10-20", raw_text: "mid BUF" })
    ]);
    expect(candidate.samples.map((sample) => sample.text)).toEqual(["new BUF", "mid BUF", "old BUF", "FLA"]);
  });
});

describe("candidateConfidence", () => {
  it("is zero with no tagged posts and saturates at full share and volume", () => {
    expect(candidateConfidence([])).toBe(0);
    expect(candidateConfidence([40])).toBe(1);
    expect(candidateConfidence([15, 15])).toBeLessThan(candidateConfidence([30]));
  });
});

describe("findTeamConflicts", () => {
  const review = (handle: string, teamAbbrevs: string[], verdict: BeatReporterReview["verdict"] = "beat"): BeatReporterReview =>
    ({ handle, verdict, teamAbbrevs, reviewedAt: "2026-11-07T20:00:00.000Z", evidenceCount: 40 });
  const after = { snapshot_date: "2026-11-20" };

  it("flags a confirmed reporter whose posts since the review mostly name another team", () => {
    const rows = [...posts("moved", "NYI", 40), ...posts("moved", "CHI", 5, after), ...posts("moved", "NYI", 1, after)];
    const [conflict, ...rest] = findTeamConflicts(rows, [review("moved", ["NYI"])]);
    expect(rest).toEqual([]);
    expect(conflict).toMatchObject({ handle: "moved", postCount: 6, suggestedTeams: ["CHI"], conflict: { assignedTeams: ["NYI"], postsSince: 6, assignedShare: 0.17 } });
  });

  it("ignores pre-review posts, small samples, majority-assigned posts and not-beat reviews", () => {
    const rows = [
      ...posts("steady", "TOR", 4, after), ...posts("steady", "MTL", 3, after),
      ...posts("quiet", "BOS", 4, after),
      ...posts("old", "SEA", 30),
      ...posts("rejected", "DAL", 10, after)
    ];
    expect(findTeamConflicts(rows, [review("steady", ["TOR"]), review("quiet", ["NYR"]), review("old", ["VAN"]), review("rejected", [], "not_beat")])).toEqual([]);
  });
});
