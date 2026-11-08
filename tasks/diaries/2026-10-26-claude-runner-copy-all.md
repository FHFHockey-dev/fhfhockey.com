# Runner terminal "Copy all" — 2026-10-26 (Claude)

- Scope: add a plain-text "Copy all" button to the /db/runner live terminal. UI only; no API/store changes. Uncommitted; orchestrator commits.
- Where: octoberBranch, canonical checkout. Files: web/pages/db/runner.tsx, web/styles/RouteRunner.module.scss, web/__tests__/pages/db/runner.test.tsx. Receipt: tasks/artifacts/runner-copy-all-2026-10-26/RECEIPT.md.
- Plan: shared `terminalLine(event)` used by render and copy so copied text == displayed text; clipboard.writeText, fallback to hidden textarea + execCommand("copy"), else "Copy unavailable".
- State: done, uncommitted. Vitest 8/8, tsc 0 errors, eslint clean, scss pure check OK. Receipt written with sha256s. No browser check.
- Next: orchestrator commits the 3 files + receipt; retire this diary after that commit.
- Gotchas: full `npx tsc --noEmit` OOMs on the default heap; use NODE_OPTIONS=--max-old-space-size=8192. jsdom `textarea.select()` doesn't focus, so the fallback test reads the textarea directly.
