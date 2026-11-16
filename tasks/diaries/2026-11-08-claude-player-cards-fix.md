# 2026-11-08 Claude: player-card test fix (lane for Chef local_c4e6c533, PR #379 gate)

- Scope: make web/components/player-cards/CurrentPlayerCardStudio.test.tsx pass by fixing the real cause; owned web/components/player-cards/**, web/lib/player-cards/**.
- Cause: not a UI regression. 05d042a0f added CurrentPlayerCardStudio.test.tsx and PlayerLookup.test.tsx without RTL cleanup(); vitest runs with globals off, so auto-cleanup never runs and renders pile up across tests ("Found multiple elements"). Sibling test files already call cleanup(). Same commit made "NHL results" the default card source in pages/social-share/player-cards.tsx, so the fabricated-preview status line (artwork source only) is no longer in the default render; cardEvidenceVerdict.test.ts rendered the default with static markup.
- Fix: cleanup() in afterEach (two files); moved the status-line test into lib/player-cards/studioEvidenceStatus.test.tsx (jsdom), which asserts the line is absent in NHL mode, switches Card source to artwork, and keeps every original assertion.
- Checks: vitest components/player-cards + lib/player-cards 32 files / 285 passed, 1 skipped; eslint changed files exit 0; npm run typecheck exit 0. No dev server needed (no UI change).
- State: committed, not pushed (Chef merges #379). Diary can be retired once Chef confirms.
