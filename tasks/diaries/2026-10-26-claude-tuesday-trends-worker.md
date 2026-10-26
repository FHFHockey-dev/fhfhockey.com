# 2026-10-26 Claude — Tuesday Trends worker (lane TT)

## Scope
Make `/social-share/tuesday-trends` a truthful, data-backed edition from native data. Offline only (fixtures shaped like real columns). Stop after READ-PLAN and message the chef (local_9c175312…). No production reads.

## Where
- Checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, base HEAD cd73cbd69.
- Write paths: lease TT in CLAUDE-LEASES.json.
- Artifacts: `tasks/artifacts/tuesday-trends-2026-10-26/`.

## Decisions (checkpoint 1)
- Ownership source: `yahoo_player_ownership_history` (PK player_key+ownership_date, anon SELECT policy, date index). Two global dates: latest D and latest date <= D-5.
- Movers mapped to NHL ids via `yahoo_nhl_player_map_read`; team from the latest rolling row's per-game `team_id`.
- PP unknown vs none from `powerPlayCombinations` (PK gameId+playerId): game has rows + player absent = none; no rows = unknown.
- PP TOI from the all-strength row's `pp_toi_seconds_*` columns (same writer); EV TOI from `ev` rows for shown deployment players only.
- Server computes the lists; only shown players leave the server. Tuesday branch runs before the UPSTREAM_READ_FORMATS gate, so the format registry in types.ts is untouched.
- Stale sources: not ranked; the reason names the as-of date.

## State (checkpoint 2, ~16:00Z)
- Built: trends.ts (sections, contract), trendsFixture.ts (real-column-shaped rows), trendSources.ts (bounded loader), server.ts Tuesday branch, TrendCard UI, export token.
- Checks: Vitest 215/215 (lib/socialShare + components/SocialShare), eslint 0, full tsc 0, CSS pure OK, E2E 31/31 on :3110 with the deny preload. Monday 9 and Wednesday 9 PNG pins are byte-identical once the committed OTT.png is served (the dirty OTT.png changes only the Ottawa logo cells). New Tuesday pins are in run/tuesday-pins.txt.
- READ-APPROVAL.md (chef/TJ) appeared in the artifact folder: the ceiling is ≤40 statements, ≤1000 rows each, concurrency 2, and approved tables only. Fixed concurrency to 2 (asserted in the test). The `players` names read is outside the approved tables, so it is an open question for the chef.

## Next
- RECEIPT-1, commit with explicit pathspecs, message the chef. Then wait for the capture ticket and the decision on `players`.

## Blockers / approvals
- Genuine capture needs a chef ticket. The `players` table needs approval, or the names must come from the map (READ-PLAN.md).

## Gotchas
- The dirty `web/public/teamLogos/OTT.png` (not ours) breaks the Monday grid/easiest and Wednesday grid pins. Use `SOCIAL_SHARE_LOGO_OVERRIDE_DIR` with `git show HEAD:web/public/teamLogos/OTT.png` to verify the pins.
- The Playwright runner cannot import SocialShare.tsx (SCSS), so the shared strings live in trends.ts.

## Checkpoint 3 (TT-2, ~16:20Z)
- Committed 82490cd45 (offline build). TT-2 ticket: TJ approved N1 (`players`) via the chef pop-up; addendum in READ-APPROVAL.md.
- Label fix: "PCT PTS ROSTERED" and "pct pts = …". Monday 9 and Wednesday 9 pins are byte-identical; the Tuesday movers pin changed.
- One genuine capture at 16:00:00Z: 11 statements, max 2 in flight, max 1,000 rows, 0 errors. Facts are in RECEIPT-2. Re-run NOT used.
- Found: the per-row freshness rule dropped 55 current skaters (the writer writes each row once). Fixed offline with a regression test. The captured layer predates the fix.
- Found: hot/cold is empty on Oct 26 because nobody has ≥ 15 GP. That is a contract minimum, so the decision belongs to the chef/TJ.
- Next: chef decides the hot/cold minimum and whether to spend the one re-run (with the freshness fix).

## Checkpoint 4 (TT-3, ~16:45Z)
- TJ (chef pop-up): hot/cold → Recent Form `recent-form-v1-early` (last 5 vs preceding 5 appearances, all 10 this season). Derived as last10 − last5 from R1 (one extra column, no new statement); proof uses season GP ≥ 10 and whole season points.
- Deployment: abs(TOI) ≥ 1:00 sets the column by its sign; role-only rows follow the role; mixed role-only rows are left out; the hero never contradicts the column.
- Movers show integer precision.
- The one approved re-run is used: 11 statements, 0 errors, 439 Recent Form qualifiers, footer updated Oct 26 10:15 UTC. E2E 33/33 with pins. Vitest 221.
- tsc: 3 errors, all in other lanes' dirty files (player-cards, rosterScheduleData); 0 in social-share.
- No more approved reads remain. Any new capture needs a new TJ approval.

## Checkpoint 5 (TT-4 visual pass, ~19:00Z)
- Tuesday is live: master 19890a8cb (#386). octoberBranch was synced by the chef (42688ceae).
- Tiles reuse Monday's TeamBanner, role chips, the flame-badge pattern and the neon hero. Green/red accent follows the hero sign.
- Sparklines derive from season-to-date columns via contiguous-row differences, with consistency checks and gaps. They need READ-PLAN v2 S1/M2 (two new statements, approved tables): TJ approval is needed before deploy.
- Captured run-2 has no series, so genuine after renders have no sparklines; fixture after renders have them.
- Checks: Vitest 228, E2E 33 with pins, tsc 0, eslint 0, CSS pure OK.
- TT-4 add-on: two PP units only (the writer's unit 3 = incidental PP time) → off PP on Tuesday; Monday roleChipList has no PP3 chip. All 18 Monday/Wednesday pins identical. Vitest 229, E2E 33, tsc 0.

## Checkpoint 6 (TT-5)
- S1/M2 sit behind SOCIAL_SHARE_TUESDAY_SPARKLINES (default off); with it off there are no extra statements and no sparklines.
- Movers use OwnershipSparkline (read-only import), complete series only. Fill and stroke are stamped as attributes because html-to-image drops class styles on SVG children.
- Neon outlines: offline tracer from committed logos → public/teamLogos/outline/*.png (32). The canvas tint is inlined as a data URL. Fallback (home-page card art): NYR, NYI, WSH, OTT, DET.
- Checks: E2E 33 with all Monday/Wednesday pins, Vitest 231, tsc 0.
- Ottawa add-on: new OTT committed by the chef (e6e5798bf); outline re-traced; OTT back to neon. Pins changed: monday-grid, monday-easiest, monday-tiers-wide, wednesday-grid (Ottawa cells only); 14 others identical. E2E 33 (two passes due to a dev /404 loop).
- TT-6: flag default ON (=0 kill switch) per READ-APPROVAL addendum 2; E2E 33 against the v2 pins (Tuesday pins unchanged); Vitest 231; tsc 0.
- TT-7: tracer v2 (all 32 legible, fallback list empty), lighter halo, home-page light-card tile layout; E2E 33 with the v2 Monday/Wednesday pins; Vitest 231; tsc 0.
- TT-7b: hero row no-wrap (the export clone wrapped it), stacked text column clears the logo, name shrink-to-fit/wrap/ellipsis; E2E collision guard (stress + genuine); E2E 34 with v2 pins; Vitest 231; tsc 0.
- TT-8 (+add-on): Tomorrow font token/@font-face/export, neon stripes, vertical group labels, Hot/Cold rename, outlines v2.5 (midpoint stroke, Euclidean gradient, 5 per-team overrides, COL A restored); E2E 34; Vitest 231; tsc 0. Raised: PROMOTIONS/DEMOTIONS vs the TOI-first column.
- TT-9: Deployment vertical labels MORE ICE / LESS ICE (TJ); ice-time tiles drop the redundant badge, role-only tiles keep PROMOTED/DEMOTED; E2E 34 with v2 pins; Vitest 231; tsc 0.
- TT-10 part 1 (layout): Hot/Cold spark fill, deployment mini table, rates stacked layout, filled stripes, white logo shadow, mirrored right column; guard covers every data-part and clipping; E2E 34 with v2 pins; Vitest 231; tsc 0. Waiting for part 2 (data).

## Checkpoint (TT-10 part 2 NOT started; usage limit) — plan for the next session
- Rostered % on all tiles: O3 already reads every ownership row at D, so no new ownership read. Need nhl→yahoo for shown non-mover ids: ONE new statement M3 = yahoo_nhl_player_map_read select yahoo_player_id,nhl_player_id where nhl_player_id in (≤27 shown ids, as strings), cap ids×4, after N1. READ-PLAN v3: typical ~15, worst ~22 (ceiling 40). Needs TJ approval before RC.
- Match the map's yahoo_player_id to ownership player_key or String(player_id); conflicting values → "—". Show only when ownership is fresh (D ≥ today−1); missing ≠ 0. Footer: "Yahoo rostered % as of D". Suggested display: in the team tag ("PHI · R · 45%"); movers keep their own.
- Line/PP chips on every tile: the latest rolling row plus ppEvidence (PPC already read for all active players' games) → no new read. Two-unit rule; "PP ?" for unknown; nothing for an unknown line. Deployment keeps its change chips.
- Tests: rostered present/missing/stale/ambiguous; chips unknown vs off PP; collision guard (already covers data-part and clipping).
- TT-10 part 2: rostered % on tags (— when missing), role chips on Hot/Cold/Rates/Movers, footer 'Yahoo rostered % as of D', M3 read (READ-PLAN v3 pending TJ). Rates tag moved top-left (guard caught tag/detail overlap). E2E 33+1 with v2 pins pass; renders in tt10/after2. Next: vitest/eslint/tsc/pure logs, RECEIPT-10 part 2, commit.
- TT-10 part 2 checks: E2E 34 (v2 pins), Vitest 236, eslint 0, CSS pure OK; full tsc exit 2 only from another lane's untracked player-cards test. RECEIPT-10 part 2 written; committing with explicit pathspecs. Next: report the SHA and the READ-PLAN v3 delta to the chef; M3 waits on TJ approval before any RC.
- M3 approved by TJ (READ-APPROVAL addendum 3, 22:41:20Z, runtime page loads only); READ-PLAN v3 and CONTRACT now reference it.
- TT-11: team-colour neon logos (teamNeon.ts floor 4.5:1, per-team tint, --neon-halo); contact sheet tt11/; E2E 34 (v2 pins), Vitest 239, eslint 0, tsc 0, CSS pure OK; renders tt11/fixture + genuine-run2. Committing; colour flags in RECEIPT-11.
- TT-12: overrides/spreads in teamNeon, 9 baked multi-colour outlines (tt12/bake-multicolour-outlines.mjs), sheets in tt12/; E2E 34 (v2 pins), Vitest 240, eslint 0, tsc 0, CSS pure OK. Committing.
