/**
 * Decision 152 (TJ, 2026-11-13): team-games whose official PP reference is the
 * NHL HTML Penalty Summary instead of the stored `teamGameStats` total.
 *
 * Each entry is one team in one game, checked against the fetched page (F11
 * O4, pp-clock-validation-2026-11-13/REPORT.md section 9). It keeps both
 * source values and why the HTML report was chosen. `buildTeamPpClock` uses an
 * entry only when the stored row still reads exactly as recorded here, the
 * play-by-play is complete, the audit finds no disagreement and the clock
 * equals the Penalty Summary total to the second. Otherwise the
 * `teamGameStats` verdict stands. The stored row is never changed, and a
 * team-game not listed here is never affected.
 */
export type PpPenaltySummaryReference = {
  gameId: number;
  teamId: number;
  /** The stored `teamGameStats` row when the entry was made; kept, never overwritten. */
  teamGameStats: { powerPlayToi: string; powerPlay: string };
  /** The team's Penalty Summary "Power Plays (Goals-Opp./PPTime)" cell. */
  penaltySummary: string;
  decision: 152;
  reason: string;
  sourceUrl: string;
  /** sha256 of the fetched page bytes. */
  sha256: string;
  /** When the fetched page was saved (UTC). */
  fetchedAt: string;
};

export const PP_PENALTY_SUMMARY_REFERENCES: readonly PpPenaltySummaryReference[] = [
  {
    gameId: 2026020036,
    teamId: 68,
    teamGameStats: { powerPlayToi: "02:00", powerPlay: "1/1" },
    penaltySummary: "1-2/02:28",
    decision: 152,
    reason:
      "The P2 14:01 scrum leaves one extra home minor, a 28 s power play scored on at 14:29. The stored row (1/1, 02:00) leaves it out.",
    sourceUrl: "https://www.nhl.com/scores/htmlreports/20262027/GS020036.HTM",
    sha256: "be79c02b473885f2ffd34e4f19c3edd320f3f910962b573e7afd622eb57dff89",
    fetchedAt: "2026-11-13T17:15:25Z"
  },
  {
    gameId: 2026020153,
    teamId: 9,
    teamGameStats: { powerPlayToi: "12:26", powerPlay: "1/9" },
    penaltySummary: "1-7/10:26",
    decision: 152,
    reason:
      "Offsetting fighting majors and equal roughing pairs create no power play. The stored row (1/9, 12:26) counts 2 more power plays and 2:00 more.",
    sourceUrl: "https://www.nhl.com/scores/htmlreports/20262027/GS020153.HTM",
    sha256: "5679b51e8bd9fbf64437d74467ad9ed91b312bd5c733a3977ba2d9adf8d9a71f",
    fetchedAt: "2026-11-13T17:15:35Z"
  },
  {
    gameId: 2025021248,
    teamId: 8,
    teamGameStats: { powerPlayToi: "12:26", powerPlay: "0/7" },
    penaltySummary: "0-7/14:00",
    decision: 152,
    reason:
      "No PP goals, so a 4:00 double minor and five 2:00 minors run in full (14:00). The stored row (0/7, 12:26) is 94 s short.",
    sourceUrl: "https://www.nhl.com/scores/htmlreports/20252026/GS021248.HTM",
    sha256: "e41d0809563997b5bf06e0be0daafc946c1ec6653d39fba0088a56fd3473c812",
    fetchedAt: "2026-11-13T17:15:46Z"
  },
  {
    gameId: 2025021097,
    teamId: 20,
    teamGameStats: { powerPlayToi: "09:24", powerPlay: "2/7" },
    penaltySummary: "2-7/09:55",
    decision: 152,
    reason:
      "09:35 at 5-on-4 plus 0:20 at 5-on-3, including the P3 11:14 interference major. The stored row (2/7, 09:24) is 31 s short.",
    sourceUrl: "https://www.nhl.com/scores/htmlreports/20252026/GS021097.HTM",
    sha256: "b00c33de09a92240c7e45159e449cd8108b79a9f0ddb1df271d70d23d1685588",
    fetchedAt: "2026-11-13T17:15:56Z"
  },
  {
    gameId: 2025030112,
    teamId: 6,
    teamGameStats: { powerPlayToi: "10:12", powerPlay: "1/6" },
    penaltySummary: "1-5/08:12",
    decision: 152,
    reason:
      "08:09 at 5-on-4 plus 0:03 at 5-on-3 (two minors overlap by 3 s). The stored row (1/6, 10:12) has one more power play and 2:00 more.",
    sourceUrl: "https://www.nhl.com/scores/htmlreports/20252026/GS030112.HTM",
    sha256: "9ac31c06e33ebe5b5681ee24a0ccb1f121ffa3f8da096e49cce7c19b63d8d3a3",
    fetchedAt: "2026-11-13T17:16:06Z"
  }
];

/** PP seconds from a Penalty Summary cell such as "1-2/02:28"; null when it doesn't parse. */
export function penaltySummarySeconds(cell: string): number | null {
  const match = /^\d+-\d+\/(\d{1,3}):([0-5]\d)$/.exec(cell);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function findPpPenaltySummaryReference(
  gameId: number,
  teamId: number
): PpPenaltySummaryReference | null {
  return (
    PP_PENALTY_SUMMARY_REFERENCES.find(
      (entry) => entry.gameId === gameId && entry.teamId === teamId
    ) ?? null
  );
}
