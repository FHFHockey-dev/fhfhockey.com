# SS1 receipt: Game Grid social-share, Monday "Best schedules + streamers" edition

- Lane: SS1 (Claude). Spec: CLAUDE-20261024-009 and CLAUDE-20261024-010.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, dirty tree. No Git writes; this is a patch hand-back for Codex.
- Fixtures only: no Supabase, NHL or other external reads. Every Node process ran under `net-deny-log.cjs`. Its log (`node-network.jsonl`) holds one denied entry, npm's own `registry.npmjs.org` check, and no production host.
- Server: `PLAYWRIGHT_ISOLATED_NEXT=1` on :3110, distDir `.next-playwright`. It was stopped at handoff, and :3110 has 0 listeners. :3000 and :3105 were not touched.

## What was built

- **Default card**: on `/social-share/game-grid`, the Graphic select now defaults to **"Best schedules grid (Monday default)"**. It is one 1080 × 1080 square:
  - FHFH brand, the title "BEST SCHEDULES" and the week range.
  - All 32 teams in two 16-row panels, ranked 1–32 by the existing Game Grid `calcWeekScore`, using the already-computed `snapshot.rows` order.
  - Mon–Sun columns of 44 × 44 square cells. Each cell shows the opponent's logo.
  - Compact marks: an `@` corner badge for away games, a tinted cell for home, a green outline for an off-night game (8 or fewer NHL games), and `×2` for a doubleheader.
  - Day headers show the full-slate game count. Off-night columns are tinted green.
  - A GP column shows games left and the number of off-night games.
  - Ranks 1–3 get a rail.
  - The footer has a legend, the provenance line and "SCHEDULE ONLY".
- **Trust rules carried over**:
  - An untrusted edition (partial, stale, failed or expired) becomes "KNOWN SCHEDULES". Teams are listed alphabetically with no ranks, the card says "Ranking unavailable", and export is disabled.
  - A team with zero remaining games gets no rank.
  - Games that are unselected, elapsed or live are dimmed and not counted. Postponed and nonregular games are omitted.
- **Logos**: owned `/teamLogos/{ABBR}.png` files are downscaled client-side to 96 px data URLs, so the export embeds small images. A missing logo becomes an abbreviation tile. Export waits until every team's logo has settled.
- **Extra cards**: specced in `EXTRA-CARDS.md`, none built. Cards 1–4 need opponent ratings, `yahoo_players` ownership or player-stat contracts that are Codex-owned or need a production read. Card 5 (games remaining / off-nights) already exists as the "Top three schedule leaders" and team-focus options.
- The `remaining-week` format keeps its leaders card as the default; the grid is available there as an option. Tuesday–Friday formats are untouched and still gated.

## Requirement-by-requirement

| Requirement (CLAUDE-009/-010) | Status | Evidence |
| --- | --- | --- |
| Square 1:1 cards only, 1080 × 1080 | Met | e2e `downloadedPng` checks the PNG header and dimensions = 1080 × 1080 on every export. Geometry check: the card has no overflow. |
| Unlinked preparation page, no nav links | Met (unchanged) | No component or page links to `/social-share/*`; `rg` finds only the `lib/seo.js` noindex list. The page sends `noindex, nofollow` (e2e). |
| Download PNG | Met | `monday-best-schedules-grid.png` and `monday-grid-missing-logo.png`. Preview-vs-export fidelity on the default card is 0.63% differing pixels against a gate of < 2% (`fixture-fidelity.json`). |
| One clear default card plus optional extras | Met | The Graphic select defaults to `grid` (e2e asserts `toHaveValue("grid")`). Extras are the existing leaders and team-focus options. |
| No automatic posting | Met | Nothing posts; the page only offers Download PNG and Copy alt text. |
| Compact logo grid ranked best-to-worst by Game Grid weekScore | Met | Unit: order and ranks equal `snapshot.rows`, and each score equals `calcWeekScore(...)`. e2e: the rendered `data-team` order and rank text equal the edition's rows. |
| Mon–Sun columns of opponent logos | Met | Unit: 7 cells per team, in date order. e2e: 224 cells, 0 broken images. |
| Compact home/away marks; square cells | Met | Unit: home and away mirror between opponents. e2e: every cell has `offsetWidth === offsetHeight` (44 px), and there is exactly one `@` per game. |
| Missing logo falls back cleanly | Met | e2e aborts NJD.png and checks that an "NJD" tile renders and the PNG exports. |
| Untrusted editions never publish rankings | Met | e2e (partial source): alphabetical order, empty ranks, "Ranking unavailable", Download disabled. The 7 pre-existing trust tests all pass. |
| Extra cards specced; at most one built | Met (0 built) | `EXTRA-CARDS.md`. |
| Pickups 50/30/20% from `yahoo_players` | Specced only | Needs Codex's ownership contract and TJ's approval for a production read (EXTRA-CARDS #3). |
| Hits/SOG/Blocks; games remaining/off-nights | Specced / existing | EXTRA-CARDS #4 and #5. |
| Consume Game Grid / ownership read-only | Met | Only the existing `calcWeekScore` / `calcWeightedOffNights` imports, via the unchanged `schedule.ts`. No GameGrid, commandCenterData or font edits. |
| Tuesday–Friday out of scope | Met | Untouched; e2e still checks they stay gated. |

## Checks run

- Vitest `lib/socialShare/`: **29/29 pass** (23 existing + 6 new in `mondayGrid.test.ts`).
- Playwright `e2e/social-share.spec.ts` in skip-server mode against the isolated :3110 server: **9/9 pass** (7 existing + 2 new), 14.6 s.
  - Output: `e2e-run.log`, `results.json`, `test-results/`.
  - Test 3 now selects the leaders card before checking long names, because the grid shows logos, not names.
- ESLint on the touched directories and spec: exit 0.
- Full `tsc --noEmit` (8 GB heap): 2 errors, both outside SS1. They are `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22` (Buffer/BinaryLike). There are 0 social-share errors (`tsc.log`).
- Not run: `npm run build`, any remote build, any production read.

## Files (all inside the SS1 lease)

- Modified: `web/lib/socialShare/export.ts` (+`teamLogoDataUrl`), `web/components/SocialShare/SocialShare.tsx`, `web/components/SocialShare/SocialShare.module.scss`, `web/e2e/social-share.spec.ts`.
- New: `web/lib/socialShare/mondayGrid.ts`, `web/lib/socialShare/mondayGrid.test.ts`, `web/lib/socialShare/fixtures.ts` (a deterministic fictional league week, test and evidence only).
- Unchanged and still at their baseline pins: `schedule.ts`, `schedule.test.ts`, `server.ts`, `types.ts`, `pages/social-share/[format].tsx`, `pages/api/v1/social-share/[format].ts`.
- Patch: `SS1.patch`. It reverse-applies cleanly to the working tree. Its sha256 and the hashes of every lease file are in `HASHES.txt`.

## Evidence PNGs (`evidence/`; fictional fixtures, not real NHL schedules)

- `monday-best-schedules-grid.png`: the default card on a full fictional 32-team week. This is the hero image.
- `monday-grid-missing-logo.png`: the NJD abbreviation fallback.
- `default-fixture.png`: the default card on the sparse legacy fixture, used by the fidelity test.
- `monday-grid-page.png`: the full preparation page.
- The rest are pre-existing spec outputs, regenerated: team, long-name, recovered, mobile and zoom.

## Open items for the orchestrator / Codex

- Codex decides whether to accept the patch. The Git commit is Codex's.
- Building extra cards 1–4 needs Codex contracts: a read-only opponent-rating export and read-only `yahoo_players` ownership. A real production read needs TJ's direct approval.
- C7 independent review: re-run the same skip-server recipe with `SOCIAL_SHARE_EVIDENCE_DIR` set.
