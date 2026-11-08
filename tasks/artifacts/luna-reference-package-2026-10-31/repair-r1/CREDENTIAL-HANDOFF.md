# User-operated credential setup; no agent credential action

Verified destination: `/Users/tim/Code/fhfhockey.com/web/.env.local`. Exact variable: `OPENAI_API_KEY`.

The existing [manual worker](../../../../web/scripts/review-ifttt-luna.ts) reads `process.env.OPENAI_API_KEY` only after admission. It contains no dotenv, Next.js environment bootstrap or file loader. **Saving the key in `.env.local` alone does not load it into this CLI.** The [offline rehearsal](../../../../web/scripts/rehearse-luna-evaluation.ts) reads no environment or key and cannot dispatch paid requests.

Non-secret verification on October 31: `git check-ignore web/.env.local` returned the path; `git ls-files --error-unmatch` confirmed it is untracked. Node 22.11.0 `--help` confirms `--env-file=...` support. No secret contents were opened or output for this check. The October 19 [credential availability checkpoint](../../../ifttt-integration-2026-10-16/comparison-live-binding-2026-10-19/CHECKPOINT.md) documents this same user-configured location. The historical October 23 integration handoff documents process-environment access, not a secure credential installer or automated revocation service.

## Steps TJ can perform himself

1. In the funded **FHFHockey** organization and **FHFH IFTTT** project, use a short-lived evaluation key restricted to the previously inspected permissions: Responses read/write and Decisions write (`api.responses.read`, `api.responses.write`, `api.decisions.write`). Select expiry within 24 hours. If the creation screen cannot enforce expiry, retain the requirement for manual revocation within 24 hours and at evaluation completion, whichever is earlier; do not interpret a ledger deadline as key revocation.
2. In your own editor, open `/Users/tim/Code/fhfhockey.com/web/.env.local` and replace only the existing `OPENAI_API_KEY=` value. Keep one entry, preserve every other configuration entry, and restrict file access to your user (0600). Do not paste the secret into chat, a task artifact, a shell command argument or a screenshot. No agent will operate Terminal or another application to do this replacement.
3. Saving this file affects subsequent local processes that load it. It does not itself update hosted environment settings or deploy anything through the existing manual worker. Existing running processes may retain their old environment. No hosted configuration was inspected or changed in this repair.
4. Report only “key saved” plus the project, permission scope and expiry time. Do not supply the key value. Preserve dispatch disabled pending independent review, current promotional-balance verification and the approved ledger/batch handoff.
5. At evaluation completion, or within 24 hours at the latest, revoke the key in the project's API-key dashboard, remove that expired/revoked value from the local entry, and unset it in any evaluation shell. The application has no credential revocation mechanism. No reminder/automation was created by this task.

The future reviewed Node invocation must explicitly supply `--env-file=/Users/tim/Code/fhfhockey.com/web/.env.local` (before the script) or receive `OPENAI_API_KEY` through an approved process environment. An already-exported stale value takes precedence over an env-file value; start with an unset `OPENAI_API_KEY` when using the file. Do not run the paid worker simply to check the key. No paid invocation is prescribed here.

## Exact remaining handoff

Parent reports that a **separate key-creation worker's Computer Use Terminal action was denied**, with no key created. This worker did not retry that action, operate another credential route, read another secret or create credentials. The original expired key is not usable access. User-operated entry is pending; its outcome has not been inspected.

Before paid execution: independent review must accept the repaired code, frozen synthetic packets/bindings/labels and zero-retry budget; authorize the actual scoped credential use and explicit environment loading; reconcile current promotional headroom/concurrent spending; and supply an approved authoritative ledger continuation including prior exposure. The rehearsal ledger is synthetic and must never be reused for paid spending. The current CLI supports one saved packet, but this repair deliberately ships no paid batch executor or automatic key loader. A reviewed sequential execution plan must enforce the frozen batch's global stop/no-retry policy across packets. No hosted dispatch, production publication or deployment is authorized.
