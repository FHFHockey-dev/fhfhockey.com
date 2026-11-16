# DRM superstyle (/drm)

- Scope: /superstyle on `/drm` (whole page: controls, line/pair grid, matrix, coverage, history) at 390 and 1440. Passes 0–8, fix every severity. Aesthetic and style changes only.
- Ownership: index.tsx, index.module.scss, pages/drm.tsx, drm.module.scss carry the Codex DRM DDATV lane's uncommitted work. TJ (12:35): "Ignore ownership leases. We are performing aesthetic and style changes only." So: no data/logic/reader changes; preserve every DDATV hunk; never commit their hunks.
- Where: octoberBranch, canonical checkout. Backlog: `tasks/artifacts/drm-superstyle-2026-11-12.md`. Shots: session scratchpad.
- Axe MCP failed to connect; using `scripts/axe.cjs`.
- Dev server :3000 answered 200.

## Coverage ledger
| page \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| /drm        | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Log
- 12:40 setup done; starting pass 0.
- Pass 0: toenails.cjs clean (agg, raw, full-roster; 390+1440); scss-check pure OK x3. Fixed nested corners on Timeframe toggle buttons (8/6px → $radius-xs). Approved. Uncommitted.
- Matrix only renders with source=raw (aggregated has 0 qualified games pending DDATV data repair). Audit route: /drm?team=EDM&source=raw.

- Pass 1 (approved, uncommitted): matrix full-width row (drm.tsx JSX move + grid fit-content, tooltips display:none); caption stack at grid width (DateRangeMatrixView className, index.tsx output class); controls restack (Timeframe row); Strength into options2 (JSX move); cards notice left; LineHistory panel/rhythm/buttons; MatrixCoverage grouped by reason + dev-only (NODE_ENV !== production) per TJ; e2e drm-previews 2 assertions updated. Checks: drm page 26, a11y 8, view 3, LineHistory 6, e2e drm-previews 6/6 (isolated vite :3114), typecheck exit 0, scss pure OK.
- Gotcha: python str.replace with an empty `old` (bad slice) interleaved text through drm.module.scss; recovered by splitting out the inserted block. Always assert old is non-empty and count==1.

- TJ: debug jargon dev-only. Added diagnostics.ts SHOW_DIAGNOSTICS; Raw QA select hidden + sanitizeSource forces aggregated in prod; skipped rows, exclusions list, formation leftovers gated; options2 auto-fit. Prod test in DateRangeMatrixView.test (4/4). Skill rule 9 + memory added. DRM unit suite 156/156.

- Pass 2 (approved, uncommitted): dead CSS removed; literals → tokens; tooltip arrow centred; TJ unit outlines (Line Combination only, 18 edge cells verified); compact labels 13px/12px; $button-tint tokens in vars.scss + LineHistory + Rankings page-button. DRM tests 131/131 earlier; scss pure OK.

- Pass 3 (approved, uncommitted): toggle rule (axe serious 2→0), <main> root + hidden corner header (axe clean both routes/vps), primary focus ring, $border-control fields, 4px label gaps. e2e drm-previews 6/6 on temp port 3115 (3114 held by another lane's /tmp/fhfh-bos-window-coverage server PID 50728 — do not kill; temp files removed).

- Pass 4 (approved, uncommitted): missing-data copy, scope line (formatScopeDate.ts shared), cell readout sentences, LineHistory copy + dev-only diagnostics (prod test), label casing/strength names/notes. Tests: DRM+page 158/158, LineHistory 7/7, e2e 6/6 on temp 3115.

- Pass 5 (approved, uncommitted): direction confirmed (exact, quick, rink-side; moment = matrix heat cells + unit outlines). Plain-case names, colour+600 active (TJ edit), logo glow removed, history headings 600. Stripe band kept as brand.

- Pass 6 (approved, uncommitted): section-title mixin (vars.scss) for 'OILERS LINE COMBO MATRIX' (TJ: team short name) + history h2; tab title; 90% workspace; options2 minmax 8.5rem; phone scroll hint + edge fade (TJ); band stripes in px, team name centred in primary stripe (TJ). Tests 158/158, e2e 6/6.

- TJ at pass 6 close: check all 32 teams for contrast/colour rules. Computed title ink vs primary: #aaa/#ccc failed 7 teams (PHI 2.19, ANA 2.30, SJS 2.62, CHI/DET 3.50, NYR 4.24, CGY 4.32); white ≥5.08 all 32 → .teamLocation/.teamShortName $color-white. 32-team axe (both vps) running in background → scratchpad axe32.txt.

- 32-team check: first axe run invalid (zsh no word-split of $ROUTES; use PAGES env). Real run 62/64 clean; VGK 46/43 serious = line-card team ink. Fixed with readableInk() in getTeamColors → --card-ink/--card-ink-secondary. VGK clean after. NOTE coverage gap: VGK is the only team with qualified data (cards + observed units) — add /drm?team=VGK to every remaining pass.

- DETOUR (TJ): VGK qualified-data UI (LinePairGrid cards, ObservedUnits). Resume point: pass 7 start (dataviz), routes EDM/raw/VGK.

- Detour done (TJ approved incl. edits): card ink, card body face, 4-col stats, unit rows + bars, phone line rows (vertical labels, goalie column), card copy 'No … stats for this range.'
- TJ: Line/Pair labels caps + italic + $font-family-sporty. Then RERUN passes 1–7 on the refactored page (EDM, raw, VGK; 390/1440).

- Rerun pass 1 (approved): units+cards → full-width row after both control panels (drm.tsx move); label gap (max-content col); VGK nickname from full name (teamNickname). 

- Rerun pass 2 (approved): LinePairGrid tokens, hairlines 1px, dead .goalies. Rerun pass 3 (approved): axe clean 3 states×2 vps; logo alt="", card h3s, abbr stat names, role=list.

- Rerun pass 4 (approved): Played N of N games, Other combinations, Regular season, empty line-combo message. e2e 6/6.

- Rerun pass 5 (approved): only brand hits; label tracking 0.04em. Rerun pass 6 (approved): observed groups grid 2fr|1fr, PP/PK beneath (TJ), data-kind on sections.
- Next: pass 7 dataviz (first run) on EDM/raw/VGK.

- Pass 7 (approved): matrix legend; F+D violet #9085E9 (validator all pass). /lines palette logged (Low, other page).
- Pass 8 final sweep: axe clean 4 states×2 vps; toenails 0; focus all visible; slop brand-only; empty-frame alignment fixed; tests 158/158; typecheck 0 (fixed info.location nullable); lint 0; e2e 6/6 (temp port 3115). Nothing committed or pushed.

## Next
- TJ: leave uncommitted. Hand-off written in the backlog artifact. Remaining: /lines matrix palette (Low, other page). Diary kept until the changes are committed with the DDATV candidate.

## Gotchas
- Commits: files are mixed with DDATV hunks, so a pathspec commit would sweep their work in. Ask TJ before any commit (stage only own hunks or skip commits).
