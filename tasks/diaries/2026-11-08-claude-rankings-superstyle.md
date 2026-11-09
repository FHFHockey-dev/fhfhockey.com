# Rankings superstyle (2026-11-08, Claude)

## Scope
/superstyle on web/pages/rankings.tsx — 9 views (TJ kickoff 11-08): default order, fix every severity, backlog in
tasks/artifacts/Rankings-Superstyle-2026-11-08.md. Axe MCP failed to connect → local scripts/axe.cjs.

Views: /rankings · ?entity=goalies · ?entity=teams · ?tab=metric_explorer · ?tab=deployment_tiers · ?tab=trending ·
?tab=splits · ?tab=war · ?entity=goalies&tab=trending (Source Pending)

## Where
Branch octoberBranch. Files: web/pages/rankings.tsx, web/styles/Rankings.module.scss, web/components/Rankings/*.
Commits: fd65f7ac8 (pass 0), bdb036b20 (passes 1–7 + final sweep), a70c52f89 (WAR route test copy).
Released 11-09 in PR #424 → master 7f91fc449 (Chef; smoke /rankings 200).

## Coverage ledger
| view \ pass        | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| skaters            | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| goalies            | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| teams              | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| metric_explorer    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| deployment_tiers   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| trending           | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| splits             | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| war                | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| source pending     | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## State / checks
- Pass 0 done: toenails.cjs 9 views × 390/1440 → 1 hit (.metaPanel inset 1px white top highlight on 6px radius), removed, TJ approved.
  SETUP sweeps (methodology popover open; controls collapsed) clean. scss-check pure OK. Nested corners on toggles: flush fills in clipped parent, OK.

## Next step
State (11-09): all superstyle passes (0–7) and the final sweep are done and live (PR #424, master 7f91fc449).
Next pass / open items (none blocking):
1. Run the rankings e2e spec (web/e2e/rankings.spec.ts was edited for the new copy/layout but never run): `npm run test:e2e:rankings` (isolated Next per memory; Playwright base URL rules in AGENTS).
2. Publish the other 15 composite contexts (Last 20 × all_skaters; Season + Last 20 × L1–L4, P1–P3), ~7 min DB reads each, overnight, one at a time, TJ approval required.
3. Rolling writer leaves toi_seconds_avg_last10/20 + career_games_played null; rankings infer Last-10/20 games from TOI meanwhile (other lane).
Not mine, leave alone: uncommitted lib/rankings matrix/composite/comparison/snapshot files (Codex/composite lanes).
Backlog detail: tasks/artifacts/Rankings-Superstyle-2026-11-08.md.

- Pass 1 (approved, uncommitted): filter grid rows reset <1240px, rail = grid col, Quick Info removed → ⓘ preset popover;
  goalie/team name column (stacked identity, sticky 350px); team Style cell glyph + tint; desktop <1100px tall starts with
  filters collapsed (tabs outside collapsible), one-line matrix footer, band key cascade fix + solid fills; goalie/team
  pagination; .panelHeading defined; snapshot box "No snapshot"/Loading/Unavailable; Min GP default scales with window
  (lib/rankings/rankingUrlState.ts). Tests: RankingsFilters, GoalieTeamMatrixTable, PlayerMatrixTable, rankingUrlState
  (44/44 across lib+components). Phones: sticky name col 170px, team abbr + text deployment tag. typecheck exit 0. e2e spec edited (viewport 1280×1200, quick-info lines) — e2e NOT run.

- Pass 2 (approved, uncommitted): .page 90% max-width (phones calc(100%-20px), TJ); 36 radius literals → tokens;
  44 font-weight literals → $font-weight-bold (all rendered 700 anyway); buttons/selects inherit font (were Arial);
  Train One on tabs/toggles/Show controls (+12px, 0.03em, label-sized segmented cols, WAR short label, 1241–1439 Tools
  2-row); score tones derived from tokens via rgb-triplet(); tile gloss/shadow removed. 0 colour literals left.

- Pass 3 so far (approved, uncommitted): tile ink per tone (4.5:1), canonical active toggle (opaque fill+ring, 9.7:1),
  page-button mixin (TJ rule: toggles white text / buttons blue text; recorded fhfh-styles §9.4 + memory), ScrollRegion
  component (focusable named regions + focus-only "← → to scroll" hint). Axe: 241 serious → 0 on 9 views × 2 vps.
- DETOUR (TJ 11-08) DONE except Teams verify: compact heatmap matrix (density=compact default ≥1241px, Detailed toggle),
  snapshot rail → drawer (Snapshot ▸ / row select / Esc), $percentile-band-* palette in vars.scss (muted R→O→Y→G,
  95–100 teal-green), bare 11px values + Martian Mono numbers (ScoreText.tsx hides %), 170px name col, goalie role
  two-row colour-coded cell. Mockups A/B/C chose A2. Typecheck exit 0 (before role/number edits), tests 27/27.
  Team API ~113s locally (backend slow); Teams compact capture pending.
  Pass 3 closed: focus.cjs all stops visible; landmarks single banner/main/contentinfo, h1→h2→h3, no dup ids;
  drawer focus in/out (Close ×, back to trigger). Axe clean incl. compact + drawer open. typecheck exit 0, tests 44/44.
  Caveat/stale warnings handed to proposed session card task_1fcede72 (rankings-warnings).
  NEXT: pass 4 copy.

## Gotchas
- App restarted 11-08 ~18:00: scratchpad moved to /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/<session>/scratchpad; old shots remain in the spare-1M80dp path.
- Another lane is editing web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts and lib/rankings/comparison.test.ts — not mine, never commit them.
- Stale combined selectors (.matrixLegend, .paginationControls) override new single rules later in file — grep all selectors before assuming.
- page.cjs args: `full <name> <route> <vp>`; zsh `set -- $x` does not split — call scripts explicitly.
- Dev server can be slow (shots caught loading states): rebuild "before" crops from earlier full captures.
- Splits API ~30s locally; capture splits with SETTLE_MS=35000.
- scss-check.cjs paths are relative to web/ (styles/..., not web/styles/...).

- P4 #5 (splits): cause of "Not ranked" = splits reused Season Min GP 10 for Last 20/10/5 (Last 5 max GP 5 → nobody qualified). Fix `lib/rankings/splits.ts` `minGpForWindow` (page default per window, else cap at window length) + regression test. Live API: Last 5 25/25 ranked. Remaining unranked PP/PK cells are real (0 PP/PK time, below min). UI: unranked/no-data cells → muted "–" pill, value in title/aria-label. 349 tests, typecheck 0, lint clean. Awaiting TJ pop-up.

- Pass 5 unslop (approved, uncommitted; TJ: commit at the end): audit light (no emoji/loop anim/transition-all/gradient text; uppercase+bold are FHFH brand).
  Fixes: snapshot percentile bars rainbow gradient → band colour via getScoreTileTone (PlayerSnapshotPanel.tsx); detailed tile-number
  text-shadow glow removed (+ dead compact override); preset ⓘ upright. Component+page tests pass.
- P6 #1 approved: matrix/workstation flex 0 1 auto (no dead band; roadmap follows the card).
- P6 #2 (awaiting pop-up): shared `minGpForComparisonWindow` (rankingUrlState) used by splits + trending; window games for last-N from avg TOI or inferred from TOI vs season (writer leaves avg_last10/20 null — backlog); falling signals amber, null deltas muted. 419 tests pass.
- P6 #2–#4 approved (trending window Min GP + window games/TOI; WAR auto-fit grid; repeated LIVE/Coming soon badges removed).
- P6 #5: unpublished composite columns hidden + footer note (PlayerMatrixTable hideUnpublishedComposites). Composite dry run (read-only builder via scratch ts-node script, no upsert, no route/audit write): season/5v5/all_skaters 2026-11-07 → 732 rows, Off/Def/MCM 731, BEAST 148 (~411s). Last season published 16 contexts (season+last_20 × all_skaters + L1–4/P1–3). No prod write yet.
- P6 #5 approved; composite publish (TJ-approved, main context only): season/5v5/all_skaters 2026-11-07 → 732 rows upserted (MCM 731, BEAST 148), verified in DB. First attempt failed on a Supabase connect timeout before any write; one retry succeeded. Script: scratchpad composite-publish-main.ts (guards on date/counts/single context).
- P6 #6 approved: duplicate panel snapshot dates removed (Trending, Tiers unless mixed dates, Splits shows player count). Pass 6 closed.
- P7 #1 (awaiting pop-up): TJ chose navy ↔ burnt orange (contrast-approved B). Band tokens in vars.scss re-stepped in OKLCH (95 #487cc8 … 0 #c65e23); per-tone --score-tile-text (brand white on 95/0, dark else); --score-tile-ink mixes recomputed for 4.5:1 on 14%/22.7% tints over base/hover/selected; band key now 78% fill; goalie role code colours lifted to 4.5:1. axe clean (skaters, goalies desktop). Poles deutan/protan ΔE 23.1 (was 4.6).
- P7: Detailed layout switched to heatmap cells via shared @mixin heatmap-cells (TJ asked why Detailed wasn't the heatmap).
- P7: BEAST no-tier cells → muted dash; hideUnpublishedComposites now counts only scoreless cells (bug caught by test).
- P7: Deployment Tiers 5v5 peer group deployment → position (each bucket was ranked against itself → ~50%); test asserts peerGroupType.
- Final sweep: axe 18\/18 clean, toenails clean, 462 tests, typecheck 0, lint img-only. Teams notice → 'Data notes:'. Commit bdb036b20 (36 files, my lane only; no push).
- 11-09: Chef asked if bdb036b20 is releasable. Isolated export check found WAR route test still expecting old copy → fixed in a70c52f89 (local). Other isolated failures were export artefacts (repo-root files) or X-lane typecheck errors; reported to Chef. Release = bdb036b20 + a70c52f89.
