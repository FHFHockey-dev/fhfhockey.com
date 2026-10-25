# 2026-10-25 Claude C2 — Team Colors card small-text / PNG readability

- Scope: package C2 in tasks/today-plan-2026-10-25.md. Footer/source/population/limitation text in EditorialPlayerCard (used by HeroPlayerCard in the share studio) + studio SCSS. No redesign, no aspect change, no Studio TSX/Hero/shareExport edits.
- Where: isolated snapshot /private/tmp/fhfh-c2cards-isolated/web (copied 14:14Z from working tree; manifest ../SNAPSHOT-MANIFEST.sha256; before-copies ../before-copies). Baselines: Editorial f3c996c4, test 99b9013b, scss 0bcab0a0.
- Custody: CLAUDE-20261025-060 transfer NOT yet posted in CODEX-TO-CLAUDE.md as of 14:14Z → canonical files untouched.
- Server: snapshot only, port 3140. Never :3125/:3000.
- State: snapshot built; next = before screenshots/PNGs.
- 14:20Z checkpoint: harness pages/c2-harness.tsx (snapshot-only, not in patch) renders the real Studio ungated + HeroPlayerCard for undefined/partial fixtures, exporting via real rasterizePlayerCard. Dummy .env.local (127.0.0.1:9) in snapshot; Playwright blocks all non-:3140 requests.
- Change (Editorial TSX only): rank 26→28, profile unavailable 18→21, ratio band 12px taller (630–778, from slack below last row), ratio rank 19→22, ratio unavailable 14→19 two lines, caption 17→19, footer 16–18→20 (18 when stacked), sample 20→22, notice 17→19; long notice moves to own line (estimate-based); fhfhockey.com moved to right of source line. SCSS unchanged (pure OK). Hero header 16px text is read-only (not touched).
- Gotcha: heavy lock is a mkdir dir with OWNER file; C1 held it 14:20Z. Width estimate first too conservative (0.6em); tuned to .53/.5 from measured widths.
- Tests: Editorial 8/8 in snapshot.
- ~14:50Z: first pass DONE. RECEIPT.md + patch (cdf9d065…) + 14/14 before/after real PNGs + compare/ in tasks/artifacts/today-plan-2026-10-25/C2/. Tests 8/8, dir 30/30, eslint ok, tsc 2 unrelated Luna errors, pure OK (scss unchanged). Dev server :3140 stopped.
- Next: apply patch to canonical only after CLAUDE-20261025-060 transfer posts (not posted yet). Open TJ decision: phone fine print still ~5–6 CSS px (fixed 1200 artwork) — caption/pan-zoom/taller format is a design choice; asked by pop-up.
- TJ chose 'Accept for now' for phone fine print (no caption/pan-zoom). Recorded in RECEIPT.
