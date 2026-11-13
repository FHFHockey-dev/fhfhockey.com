# Recent Team Form: descriptive beta display plan (for TJ's review; nothing shipped)

**Status:** proposal only, 2026-11-13. No code has been written for it, nothing is released, and no rows are relabelled.

## Direction from TJ (2026-11-13)

Show CTPI v2 now as a display-only beta on the team page.
- It describes recent play and shows its window, the games included and the as-of date.
- Label: **"Descriptive beta · not a forecast"**.
- 5-on-5 PDO, shooting % and save % sit alongside it as separate puck-luck and regression context.
- Candidate rows stay as issued.
- Nothing feeds the beta into projections, rankings or recommendations.
- TJ sees this plan before anything ships.

## 1. Placement

- **Page:** `/stats/team/[teamAbbreviation]`, Dashboard tab, card "Recent Form & Momentum" (`web/components/TeamDashboard/TeamDashboard.tsx:1350`).
- **Position:** a new block between the game-by-game timeline and the last-10 advanced metrics.
- **Not on:**
  - the FORGE team page, whose CTPI tile stays on the approved-only gate and keeps showing "CTPI unavailable for this date";
  - Start Chart, rankings, Top Adds, the game model, social share, or any `/api/v1/trends/team-ctpi` response.

## 2. What the block shows

Text mock-up for a full-coverage team (values illustrative):

```
Recent Team Form                               [Descriptive beta · not a forecast]
62  on a 0–100 scale; 50 = league average on that date
Last 10 games before Nov 13 (Oct 22 – Nov 11); recent games count more
As of Nov 13 · 10 of 10 games included

Offense         ────────┃██████       +0.6 SD   xGF/60, high-danger chances for, GF/60
Defense            ███┃──────────     −0.3 SD   xGA/60, high-danger chances against, CA/60
Goaltending     ────────┃███          +0.2 SD   goals saved above expected per 60
Special teams   —  Unknown                      PP/PK ice time missing for 2 games

Puck luck (5-on-5, same 10 games; not part of the score)
PDO 1.024   Shooting 9.8%   Save 92.6%     1.000 is league average; extremes usually regress
```

**Rules**

| Element | Rule |
|---|---|
| Score | `ctpi_0_to_100` from the row as issued, a whole number. "50 = league average on that date"; never called a percentile (decision 58). |
| Window line | The game dates come from the team's own game rows dated before the snapshot date: the last `recentGameCount` games, oldest to newest. "Recent games count more" discloses the 1.0 … 0.1 linear weights. |
| As-of line | The snapshot date (inputs are games strictly before it) and "n of 10 games included" (`recentGameCount`). |
| Components | Diverging bars centred on 0 (league average), in SD units. A null component renders "—" and "Unknown" with the reason from `missingComponents`/`warnings`; never 0 (rule 5). |
| Status | `ready`: as shown. `partial`: a line "Partial: <component> unavailable". No row, or fewer than 5 games: "Not enough games yet (n of 5)", with no score. |
| Puck luck | 5-on-5 PDO = SH% + SV% over **exactly the same games** as the window line: Σ GF ÷ Σ SF and 1 − Σ GA ÷ Σ SA from `nst_team_5v5`, unweighted ratio of sums. Separate heading, "not part of the score". |
| Badge | A neutral pill (not a button, not a toggle): "Descriptive beta · not a forecast". |
| Info tip | "Describes how the team has played over its last 10 games: shot quality for and against, goaltending against expected, and power-play and penalty-kill rates pooled by ice time. Each is compared with the league on the same date, and 50 is league average. It is not a prediction and is still being validated." |
| Debug detail | The fingerprint, warning codes, `computed_at` and the component coverage render in development only (`NODE_ENV` gate). |

**Window agreement.** The existing last-10 metrics in the same card read through the latest game. The CTPI row for today uses games before today, so the two windows match unless the team has played today. Both lines show their dates, so any difference is visible.

## 3. Data contract (no relabelling; the approved gate is not loosened)

- **Beta predicate.** Add `isDescriptiveBetaCtpiPayload(payload)` and a beta label to `web/lib/trends/ctpiVersions.ts`. It accepts only rows that meet all of these:
  - `ctpi_version` 2;
  - `publicationStatus === "candidate_unapproved"`;
  - the exact v2 formula and input versions;
  - `sourceGameCount > 0`;
  - `status` of `ready` or `partial`.
- **Approved gate unchanged.** `isTrustedCtpiPayload` (approved only) is not touched. Every predictive, ranking or recommendation reader keeps rejecting candidate rows: team-ctpi API, Start Chart, FORGE, dashboards, and the game model (still pinned to v1).
- **Rows read as issued.** No status update, no re-issue, no new rows.
- **Read path: client side, no new API route** (no serverless runtime cost). A hook `useRecentTeamFormBeta(teamAbbrev, seasonId)` makes two small anon reads, both covered by `public_read` RLS (checked 2026-11-13):
  1. `team_ctpi_daily`: the latest v2 row for the team in the season with `date ≤ today` (`payload->>formulaVersion` = v2). Selected columns and payload paths only (score, components, status, counts, cutoff, `pdoContext`, warnings), never the whole jsonb.
  2. `nst_team_5v5`: the team's rows dated before the snapshot date, newest first, limited to `recentGameCount` (`date, gp, gf, ga, sf, sa`; the same `gp` filter as the last-10 metrics).

## 4. Tests (written with the implementation)

1. The beta predicate accepts a candidate v2 row and rejects approved, v1, other versions, `unavailable` and `sourceGameCount 0` rows.
2. A regression test that `isTrustedCtpiPayload` still rejects a candidate v2 row.
3. **Import boundary:** no module in the following imports the beta predicate or hook:
   - `lib/game-predictions`, `lib/dashboard`;
   - `pages/api/v1/start-chart.ts`, `pages/api/v1/trends/team-ctpi.ts`, `pages/forge/**`;
   - `components/forge-*`, rankings, Top Adds or projections.
4. Component tests:
   - the badge text, window dates, "n of 10 games" and as-of date render;
   - a null component renders "Unknown", not 0;
   - the puck-luck block uses the same game dates and says "not part of the score";
   - the fewer-than-5-games state;
   - debug detail is absent in production mode.
5. ESLint, `npm run typecheck`, and the CSS Modules pure check after the `.module.scss` edit.
6. `/superstyle` pass on the card. Local dev screenshots for TJ, with `PLAYWRIGHT_ISOLATED_NEXT=1` if a second `next dev` is needed.

## 5. Files (after approval)

- `web/lib/trends/ctpiVersions.ts` and its test (`web/lib/trends/ctpi.test.ts`).
- New `web/components/TeamDashboard/RecentTeamFormBeta.tsx`, `.module.scss`, `.test.tsx` and `useRecentTeamFormBeta.ts`.
- The mount point in `web/components/TeamDashboard/TeamDashboard.tsx`.
- Check the coordination mailbox for claims on `components/TeamDashboard/**` before editing.

## 6. Production and cost

- No migration, no cron change and no writes. The beta reads rows the 10:10 UTC writer already issues.
- Runtime cost: two small PostgREST reads per Dashboard view; no function invocation.
- Release only with TJ's separate approval, batched with other work (one fhfhockey build).

## 7. What stays gated

- Predictive use of v2 anywhere, and the `approved` status, wait for the formal checkpoint decision (`CHECKPOINT-PROTOCOL.md`).
- If that decision is inconclusive, the beta stays descriptive and predictive use stays gated.
