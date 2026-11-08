# 2026-11-07 Claude: brand style docs merge

## Scope
Compare TJ's designmd.me extraction (`~/Downloads/fhfhockey.com-DESIGN (2).md`, production, 6 pages, 2026-11-06) with
`tasks/TASKS/rules/fhfh-styles.md` and `brand-style-cheat-sheet.md`; extract tokens from source the same way; merge the best into the pair.

## Where
- Branch `octoberBranch` (canonical checkout).
- Committed: `691819d58` (both rule docs + this diary). Not pushed.
- Child session: "Tokenise site chrome and fix control field contrast" (local_dfbd9f6b), idle. Its work is uncommitted in the checkout: 6 SCSS files + the two rule docs, diary `tasks/diaries/2026-11-07-claude-chrome-tokens-controls-contrast.md`.

## State / checks
- Derived token values computed with sass from `web/styles/vars.scss` (scratchpad script, not committed).
- Local :3000 dev server did not answer within 60s, so no fresh rendered measurement. Production values come from the designmd file.
- Checks passed: every `$token` and mixin named in both docs exists in vars.scss/_panel.scss (only wildcards and the proposed `$chrome-*` came back); the cited §-anchors are intact; the cheat-sheet YAML front matter parses (python yaml).
- 2026-11-07 orchestrator inventory: report at `~/Library/Application Support/Claude/side-session-notes/local_c4e6c533-96aa-4670-aedf-8a5331a449da/inventories/brand-style-docs.md`.

## Decisions
- Keep fhfh-styles section numbers: code comments and the superstyle skill cite §2.2, §2.6, §2.7, §4.2, §6, §9.4, §9.5, §10.5, §10.6.
- Rejected designmd claims: gold links, no status ramp, light theme, "spacious" whitespace, Train One as decorative-only, generic blue/violet cards (those are the C/RW position colours).

## Gotchas
- `$background-medium` (#131518) is darker than `$background-dark` (#1a1d21). The body is #202020 (`globals.css`).
- Roboto Condensed is only loaded at 300/400, and Train One only at 400, so bold weights are synthesised.
- The child's "PR #379" is just the open octoberBranch → master PR, not a separate PR.

## Next
TJ approval to commit the child's chrome-token + Controls contrast changes. Retire this diary once those land.
