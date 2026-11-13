import { describe, expect, it } from "vitest";

import { buildTeamRatingNarrative } from "./teamRatingNarrative";

describe("buildTeamRatingNarrative", () => {
  it("prioritizes the biggest real rating drivers before context bullets", () => {
    const result = buildTeamRatingNarrative({
      history: [
        {
          components: {
            ga60: 2.6,
            gf60: 3.4,
            pace60: 58.5,
            sa60: 26,
            sf60: 31,
            xga60: 2.7,
            xgf60: 3.3
          },
          date: "2026-04-05",
          defRating: 106,
          offRating: 109,
          paceRating: 103,
          pkTier: 2,
          ppTier: 1
        },
        {
          components: {
            ga60: 3,
            gf60: 3,
            pace60: 56,
            sa60: 28,
            sf60: 28,
            xga60: 3.1,
            xgf60: 3
          },
          date: "2026-04-03",
          defRating: 100,
          offRating: 100,
          paceRating: 100,
          pkTier: 2,
          ppTier: 2
        }
      ],
      leagueAverageFutureSos: 0.54,
      row: {
        components: {
          ga60: 2.6,
          gf60: 3.4,
          pace60: 58.5,
          sa60: 26,
          sf60: 31,
          xga60: 2.7,
          xgf60: 3.3
        },
        defRating: 106,
        disciplineRating: 101,
        finishingRating: 108,
        goalieRating: 103,
        luckPdoZ: 1.2,
        offRating: 109,
        paceRating: 103,
        pkTier: 2,
        ppTier: 1,
        scheduleTexture: null,
        sosFuture: 0.56,
        teamAbbr: "TOR"
      }
    });

    expect(result.bullets[0]).toContain("5v5 offense is rising");
    expect(result.bullets[1]).toContain("Defensive form tightened");
    // Record-only SOS, described rather than forecast (decision 93, W2-3 D16).
    expect(result.bullets[2]).toContain(
      "Upcoming opponents have a stronger combined record"
    );
  });

  it("falls back to a baseline warning when history is too short", () => {
    const result = buildTeamRatingNarrative({
      history: [
        {
          components: {
            ga60: 3,
            gf60: 3,
            pace60: 56,
            sa60: 28,
            sf60: 28,
            xga60: 3.1,
            xgf60: 3
          },
          date: "2026-04-05",
          defRating: 100,
          offRating: 100,
          paceRating: 100,
          pkTier: 2,
          ppTier: 2
        }
      ],
      leagueAverageFutureSos: 0.54,
      row: {
        components: {
          ga60: 3,
          gf60: 3,
          pace60: 56,
          sa60: 28,
          sf60: 28,
          xga60: 3.1,
          xgf60: 3
        },
        defRating: 100,
        disciplineRating: 100,
        finishingRating: 100,
        goalieRating: 100,
        offRating: 100,
        paceRating: 100,
        pkTier: 2,
        ppTier: 2,
        scheduleTexture: null,
        sosFuture: 0.52,
        teamAbbr: "DET"
      }
    });

    expect(result.bullets[0]).toContain("Recent baseline is still too short");
  });

  it("describes PDO without forecasting a rebound or regression (W2-3 D16)", () => {
    const flat = { ga60: 3, gf60: 3, pace60: 56, sa60: 28, sf60: 28, xga60: 3.1, xgf60: 3 };
    const snapshot = (date: string) => ({
      components: flat,
      date,
      defRating: 100,
      offRating: 100,
      paceRating: 100,
      pkTier: 2,
      ppTier: 2
    });
    const result = buildTeamRatingNarrative({
      history: [snapshot("2026-04-05"), snapshot("2026-04-03"), snapshot("2026-04-01")],
      leagueAverageFutureSos: null,
      row: {
        components: flat,
        defRating: 100,
        disciplineRating: 100,
        finishingRating: 100,
        goalieRating: 100,
        luckPdoZ: -1.4,
        offRating: 100,
        paceRating: 100,
        pkTier: 2,
        ppTier: 2,
        scheduleTexture: null,
        sosFuture: null,
        teamAbbr: "DET"
      }
    });

    const text = result.bullets.join(" ");
    expect(text).toContain("PDO (shooting % plus save %) is running below league norms.");
    expect(text).not.toMatch(/rebound|cool toward|could|may /);
  });
});

describe("goaltending sentence by calculation version (Astra #434 P1)", () => {
  const components = {
    ga60: 3,
    gf60: 3,
    pace60: 56,
    sa60: 28,
    sf60: 28,
    xga60: 3.1,
    xgf60: 3
  };
  const snapshot = (date: string) => ({
    components,
    date,
    defRating: 100,
    offRating: 100,
    paceRating: 100,
    pkTier: 2,
    ppTier: 2
  });
  const goalieBullet = (
    calculationVersion: string | null | undefined,
    sourceThroughDate: string | null,
    goalieRating = 110
  ) =>
    buildTeamRatingNarrative({
      history: [snapshot("2026-09-30"), snapshot("2026-09-29")],
      leagueAverageFutureSos: null,
      row: {
        calculationVersion,
        components,
        defRating: 100,
        disciplineRating: 100,
        finishingRating: 100,
        goalieRating,
        offRating: 100,
        paceRating: 100,
        pkTier: 2,
        ppTier: 2,
        scheduleTexture: null,
        sourceThroughDate,
        teamAbbr: "TOR"
      }
    }).bullets.find((bullet) => /goaltending/i.test(bullet)) ?? null;

  it("says 5-on-5 only for a verified v4 row and all-situations for a v3 row", () => {
    expect(goalieBullet("team-power-v4-5v5-goaltending", "2026-09-29")).toBe(
      "5-on-5 goaltending is outperforming expected goals against right now."
    );
    expect(goalieBullet("team-power-v4-5v5-goaltending", "2026-09-29", 90)).toBe(
      "5-on-5 goaltending is lagging behind expected goals against right now."
    );
    expect(
      goalieBullet(
        "team-power-v3-all-team-baseline-prior-after-norm-pooled-st",
        "2026-09-29"
      )
    ).toBe("All-situations goaltending is outperforming expected goals against right now.");
  });

  it("withholds the sentence for a legacy carry or an unverified row", () => {
    expect(goalieBullet("legacy_unversioned", "2026-08-29")).toBeNull();
    expect(goalieBullet(null, null)).toBeNull();
    expect(goalieBullet(undefined, null)).toBeNull();
    expect(goalieBullet("team-power-v9-unknown", "2026-09-29")).toBeNull();
  });
});
