# 2026-11-07 Claude: /superstyle Lines (edit pass)

## Scope
Full /superstyle edit pass on `/lines`, `/lines/[abbreviation]` (EDM sample), `/lines/line-combo/[gameId]` at 390 and 1440. Chef: local_c4e6c533 (LANE-RULES.md in side-session-notes). Checklist: `tasks/artifacts/Lines-Superstyle-Audit-2026-11-06.md` (re-audit against the Lane B/C state from master #413).
Own: `web/pages/lines/**`, `web/styles/Lines.module.scss` (Lines-only), Lines components under `web/components/` (LineCombinations, PowerPlayCombos/LinemateMatrix/TeamSelect only where Lines-specific; shared ones are S rows, ask Chef). Not mine: `web/lib/lines/**`, `vars.scss`, `Controls.module.scss`, toenail pages, Game Grid, Scout files.

## Where
- Branch octoberBranch, sole checkout. Isolated dev: `PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -p 3110` (restarted 11-07 with Chef OK after .next-playwright clash with a :3107 server: npm 68795 → 68818 → next-server child; Chef has adopted it as the shared screenshot server: don't stop it without telling Chef, and if it dies, tell Chef rather than restarting it). TJ's :3000 untouched.
- Scratch: session scratchpad `/superstyle-lines` (SUPERSTYLE_OUT).

## State / checks
- Start: read LANE-RULES, backlog, snapshot log, 11-06 diary, inventories.
- Lane C note (side-session-notes/local_3f3bae11…/lane-c-lines-pages.md) claims every 11-06 row closed (1d08ce7fc, 389ea0ea3, 6d29edbe0, e1120ba9c, 7af32ee7d); Lane B closed High 2 + PL rows. Re-verifying each.
- Enabled state: `/api/v1/lines/projected` serves snapshots only when `LINES_ENTRY_SERVING_ENABLED` (P4, not flipped); P3 observations alone leave the public UI unchanged (returns enabled:false → ProjectedLineups renders null). Enabled state verified with Lane B's synthetic fixture via Playwright interception (`intercept.cjs` + `make-fixture.cjs`, copied to scratch).
- Pass 0 toenails: clean on all 3 routes at 390/1440, and on fixture state /lines/TBL + line-combo/2026020150.
- axe baseline: /lines, /lines/EDM clean both vps; line-combo mobile clean; line-combo desktop moderate duplicate-contentinfo/landmark-unique/region (investigating).

- axe re-run after the server restart: line-combo desktop is clean (the earlier moderate hits were noise from the broken server). Fixture state: axe 0, toenails 0.
- Backlog: re-audit section appended (N1–N11). TJ kickoff: Go, standard order.
- Pass 0: no toenails, no changes.
- Pass 1 (critique), all approved:
  - N1 `pages/lines/line-combo/[gameId].tsx` matrix props.
  - N2 opt-in `sideBySide` on `components/LinemateMatrix/index.tsx` + `.module.scss`, used by line-combo.
  - N3 `[abbreviation].module.scss` (.lineup fill, PP margin).
  - N6 `LineShareBars.module.scss` (flat section).
  - Checks: LinemateMatrix vitest 12/12, typecheck exit 0, scss pure OK ×3.

- Pass 1 committed b63467acd.
- Pass 2 (design-system), all approved:
  - N4 `Line.module.scss` card frames → `$border-control`.
  - N8 `CategoryTitle.module.scss` + `Line.module.scss` tokens.
  - N12 PANEL_SURFACE reuse in `[abbreviation].tsx`.
  - N13 (TJ request mid-pass): PP units as team cards (3F top, D bottom, centred), PP1/PP2/PP3, PP stats over the EV cards' 10 games (`statsGameIds` added to `LineCombinations/utilities.ts` and passed by the page).
  - TJ confirmed the EV grid already reads F F F | D D / F F F | G G at 1440.
  - Data mismatch (forge vs NHL PP points; empty powerPlayToi) sent to Chef.
  - Checks: tests 63/63 (PP, LineCombinations, pages/lines), typecheck exit 0, scss pure OK.

- Pass 2 committed 60f3d57f3.
- Pass 3 (a11y):
  - axe 0 on all 3 pages at both viewports (incl. the PP cards); focus clean (only nextjs-portal, the dev overlay).
  - N5 approved: `PlayerCard.module.scss` labels 10px, values 700; `CategoryTitle` small 10px; `SkaterCard.tsx` phone labels HIT/BLK.

- Pass 3 committed 93c8528b2.
- Pass 4 (copy), all approved:
  - C1 error vs no-data in team getStaticProps (+2 tests in `__tests__/pages/lines/abbreviation-header.test.tsx`).
  - N7 line-share copy; C6 arrow alt; C7 /lines meta description.
  - Supabase degraded from ~18:05 ("transaction is aborted"/timeouts; :3000 and :3110 both slow). Told Chef and paused page requests; N7/C7 approved without screenshots.

## Coverage ledger
| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| /lines | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| /lines/EDM (+TBL fixture) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| /lines/line-combo (+fixture) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |

## Next
- Pass 4 committed 2caeb7926.
- Pass 5 (unslop), coded but not yet shown to TJ; the DB was down, so no captures:
  - N9 `styles/Lines.module.scss` chip: no tracked caps, tokens; `index.tsx` sentenceCase().
  - N10 `TeamSelect.module.scss`: the glow is replaced by a hover surface step plus an active inset 3px primary bar. Shared with /drm, so capture /drm too.
  - N11 (pass 7, prepared early) `LineShareBars.module.scss`: visible track.
  - Background waiter bn49glne2 polls /lines/EDM every 2 min until it returns 200.
- DB back 18:20. Pass 5 approved: N9, N10, N14 (L1–L4 untracked), N11 (track). slop-audit leftovers are brand 700 weights and the shared SurfaceWorkflowLinks.
- (old resume note) capture N9 (/lines desktop + mobile chips), N10 (/lines/EDM strip + /drm), N11 → pop-ups → close pass 5 → pass 6 (frontend-design) → 7 (dataviz) → final sweep.

## Gotchas
- Superstyle scripts default BASE_URL :3000; set BASE_URL=http://localhost:3110.
