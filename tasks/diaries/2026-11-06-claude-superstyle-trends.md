# 2026-11-06 · claude · /superstyle on /trends (first real run of the skill)

- Scope: /trends at 390 and 1440, using the /superstyle loop (skill at ~/.claude/skills/superstyle). Toenail pass, then 7 single-skill passes, then the final sweep.
- Where: octoberBranch; backlog tasks/artifacts/superstyle-trends-2026-11-06.md; shots in the session scratchpad (ss-trends).
- Axe MCP: CONNECTION_CLOSED → local axe-core via scripts/axe.cjs.
- First look:
  - Desktop right column overflows (risers/fallers, Next surface buttons).
  - Internal/dev copy ("strong v1 baselines", "Reserved for…").
  - 8-line smoothed chart.
  - Desktop recent-form scan empty while phone shows leaders.
  - Phone section titles clip.

## Coverage ledger
| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| /trends     | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- Kickoff approved: full loop.
- Pass 0: clean. Rendered sweep at 390/1440 covering the default state plus the Skaters/Goalies/Defense/Power Play tabs and the lazy goalie section; scss-check clean. No changes.
- Pass 1 critique (all approved, uncommitted):
  1. Overflow: implicit auto grid columns → minmax(0,1fr); TopMovers auto-fit; tables scroll. TJ edit: workspace 1.3fr/1fr, movers 2-up with tighter rows.
  2. Hero: About disclosure + link pills. TJ edits: Player Search beside the hero, Recent-Form Scan full-width 4-up, Primary lens box dropped.
  3. Placeholder panels removed. TJ edit: "Coming next" caption.
  4. Duplicate Next Surface rail panel removed.
  5. Goalie rows: flex fix, sample context on its own line (test updated).
  6. Trend legends show names. TJ edit: "F. Lastname".
- Checks: trends tests 25/25; typecheck clean for my files (other lanes: lunaHosted, buyLowSellHigh fixture, socialShare teamStream test).
- Gotchas: capture during a cold load shows empty states → added SETTLE_MS to the skill scripts; the case-insensitive FS made heroM == herom.
- Pass 1 committed: e06db3379 (7 files, local).
- Pass 2 design-system (approved, uncommitted): removed 52 dead rules (48 unused classes; dashboard.module.scss 1,408 → 987 lines). Proof: computed-style snapshot of ~5,000 elements × 23 props across 3 tabs × 2 viewports → 0 diffs (scratchpad stylesnap.cjs; deadcss.py remover). Logged: remaining raw values (Medium); CHART_COLORS → pass 7.
- Pass 2 committed (local).
- Pass 3 a11y: 0 critical at start. Fixed: active toggle text (mixin, TJ edit: no glow); focusable named scroll regions. axe 0 violations ×3 tabs ×2 viewports; focus sweep clean. Committed (local). axe.cjs gained SETUP/TAG.
- Pass 4 ux-copy (approved, uncommitted): describeLockedBaselines() replaces the "strong v1 … source contract" note on /trends and the player page (TJ edit); 13-string plain-language sweep; loading vs empty scan copy. Tests 58/58.
- Pass 4 committed (local).
- Next: pass 5 unslop.
- Pass 5 unslop started: direction approved (polish). #1 hero gradient → flat (approved).
- RULE CHANGE mid-run: the skill now says fix every severity; TJ chose "fix them now". DETOUR: clear the 7 open Medium/Low rows from passes 1–4. RESUME POINT: pass 5 unslop item #2 (Find Player button gradient + glow), then #3 (movers rows/bars).
- Detour done (all approved): rail align-self (the first try collapsed the chart; reverted); meta left-align; tokens + $radius-pill (snapshot: only font sizes 11.52→12, 14.4→14); link tooltips (shared siteSurfaceLinks); Runway → plain names + About lists/labels/eyebrow; 5 restating metas removed. Back to the resume point: unslop #2.
- Pass 5 unslop (all approved):
  - Hero flat.
  - Find Player canonical outline; TJ edit: 34px, same as the field.
  - Movers flat; TJ spec: grey 100% track, fill = Δ%, brighter second lap past 100% (old width |Δ|×8 saturated everything).
  - FORGE/LEGACY uses aria-pressed instead of disabled + glow; .tab transitions named.
  - axe clean; focus clean.
- Pass 5 committed (local; vars.scss staged by hunk, other lane hunks left).
- Next: pass 6 frontend-design.
- Pass 6 frontend-design (approved so far, uncommitted):
  1. Scan rows lead with the stat (24:01 TOI/GP, shots/60, PP TOI/GP, ixG/60) + "100th pct" line (TJ edit); ties ranked by the stat (TJ edit); rank moves named for SR. formatRecentFormValue/formatPercentileOrdinal in lib/trends/trendsSurface.ts (+tests). Logged: API percentile ≠ stat percentile (other lane).
  2. Hero: Player Search in the hero side slot; TJ edits: "Trends" on phones, 8-word description, About → info glyph beside title (notes open as overlay panel, Escape closes), no eyebrow, links as equal grid (2×2 phones / 4 across), Find Player → magnifying glass, search heading sr-only.
  3. Team cards: compact rows on phones; TJ edit: logo + solid condensed code.
  - axe clean ×2 viewports (+About open). Next: phone tables (Projections/Goalie Starts), then handoff cards, Movement header date wrap, Projections header toggle stacking.
  4. Tables: interface face for names, mono only for figures; Team column hidden on phones; matchups one line.
  5. Headers: "Projections" (toggle names the source), toggles wrap under title on phones, Goalie Starts counts rows; TJ edit: Movement date meta removed.
  6. Handoff cards: rows pinned (titles/actions aligned), one 34px control-radius button shape, no hover lift; "Projections And Starts".
  7. Goalie workload: shared 1200px chart centred (trends wrapper only); TJ edit: "L10 to season" meta removed.
  8. Skater/goalie trend charts fill their card (500px at 1440; 260 min).
  9. Lists show the stat + percentile (formatGoalieTrendValue; shared StatWithPercentile); dead .percentile removed.
  10. Phone controls: 2×2 categories, full-width segment rows. TJ edits: rows rebuilt (PlayerRankingRow: squircle headshot, rank notch, name / team·pos·move, stat over pct, goalie footer) + gold/silver/bronze notches ($medal-* tokens in vars.scss — stage my hunk only).
  11. Duplicate "trend history is unavailable" lines removed under section notices; lint apostrophes escaped.
  - Checks: trends tests 60/60; typecheck exit 0; eslint 0 errors (1 <img> warning on team-card logos, same pattern as TopMovers); axe clean ×2 viewports × Teams/Skaters/Goalies (+About open).
  - Pass 6 committed 2d844a5ad (local; vars.scss medal hunk only — the $radius-pill line move left unstaged is from the master merge, not mine). Next: pass 7 dataviz (CHART_COLORS, spaghetti).
- Pass 7 dataviz (approved; committed 624761c2c, local):
  1. Movement charts → module-level TrendLineChart highlight chart: one focused line (brand blue, 3px, 5.74:1), rest grey 1.5px, linear (no smoothing), name buttons move focus (aria-pressed), dark sorted tooltip, recessive grid/axes via scoped :global Recharts classes. CHART_COLORS + Legend removed. Test: focus switch.
  2. Risers/Fallers bars: fills 80% (red 2.21→3.18:1 on track, green 6.32); lap = 50% white tint + 2px surface gap.
  3. GoalieShareChart (shared with /stats): pickSliceColors — OKLab ΔE≥15 vs picked, contrast ≥1.4 on card, validated dark fallbacks, relaxed passes. 3 tests.
  - Gotcha: `sed` with `.` in a pattern clobbered a test comment line; use python replace for multi-char edits.
  - Gotcha: CartesianGrid ignores className; scope Recharts styles through a wrapper class with :global(.recharts-*).
- Pass 8 final sweep: axe 0 violations (Teams/Skaters/Goalies/About-open × 390/1440), focus sweep clean, toenails clean, slop audit = brand caps only; full-page read no regressions. Fix: Risers header meta removed + "Risers And Fallers" (TJ edit). Tests 100/100.
- RUN COMPLETE. Commits (local, unpushed): pass 6 2d844a5ad, pass 7 624761c2c, pass 8 (see git log). Open: API percentile ≠ stat percentile (other lane, logged in backlog).
