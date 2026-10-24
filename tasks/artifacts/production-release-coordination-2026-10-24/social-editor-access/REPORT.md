# Social editor access candidate

Local implementation under CODEX-054 exact custody. Ready for parent/coordinator review; not deployed and no account role assigned.

## Behavior

- Existing GET edition API verifies the bearer through Supabase `getUser(token)`, then reads `users.role` by verified `user_id`. Only exact `social_editor` and `admin` pass. Missing, malformed, duplicate or invalid credentials fail; unavailable/duplicate role lookups fail closed. Metadata, submitted identity, cron secrets and localhost cannot grant this permission.
- Existing five formats only: game-grid, remaining-week, tuesday-trends, player-spotlight, category-rescue. Unknown actions/formats and non-GET methods remain rejected. Blocked source formats remain blocked. No publishing/configuration permission added.
- Page and API responses are private/no-store. The API no longer applies the existing public edition cache helper. The initial HTML contains only a locked shell and generic format/time props; the data boundary is the authenticated API, not a new cookie architecture.
- AuthProvider preserves `social_editor` as distinct from admin. Role lookup errors clear authority; older role responses cannot overwrite newer decisions. Existing admin gates and middleware are unchanged.
- Studio mount waits for auth/role checks. Account switch resets the child; sign-out/revocation closes it. Edition fetches carry bearer tokens only to known relative edition routes, share pending work only for the same user/token/URL, and reject responses after session changes.
- Existing card renderer, styles, source qualification, computations and upstream loaders are untouched. PNG download and alt-text copying remain browser-local.

## Evidence

`social-editor-access.patch` is relative to the eight coordinator-pinned existing files, plus four verified-absent new files. The baseline copies and `CANDIDATE-PINS.json` retain exact before/after hashes. `patch --dry-run` against that baseline passed; see `PATCH-CHECK.log`.

- Focused Vitest: 6 files, 109 tests passed (`TESTS-initial.log`).
- Existing admin middleware/page-gate regressions: 2 files, 61 tests passed (`TESTS-admin.log`).
- Scoped TypeScript and ESLint passed (`TYPECHECK.log`, `LINT.log`, `tsconfig.social-editor.json`).
- Node 22.11.0. Shared heavy lock acquired only when absent and released after each verification group.
- Renderer, unchanged server loader and E2E specification hashes still match pre-edit observations. All twelve changed source paths are within custody.
- No application server, browser session, hosted request, credential access, DB/account write, Git mutation or deployment during implementation. Earlier separately authorized availability inspection found the live route returned `/404`; it does not verify this candidate.

## Remaining gates

1. Parent/coordinator review and integration. The separate C3 shared-auth test candidate still requires coordinator reconciliation; this patch does not include it.
2. Existing social-share E2E fixtures contain no editor session and need a separately owned auth setup before testing the gated pages. Browser execution and builds were not run by this worker.
3. Coordinator-owned approved release. This candidate does not resolve the previously observed live 404 until included in the selected deployment.
4. Separate action-time approval for role initialization on the confirmed existing account. Parent verified there is no `users` row. Use an identity-checked, short serialized transaction: insert only from zero rows; accept exactly one existing `social_editor` as an idempotent no-op; abort duplicate or conflicting rows. The current primary key is `(id, user_id)`, so `ON CONFLICT(user_id)` is not valid. No identity or grant statement is embedded in this patch.

Releasing worker edit custody on handoff. No further source edits planned without a follow-up assignment.
