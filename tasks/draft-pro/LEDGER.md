# Draft Pro work ledger

- Chef task: 01a07c1d-047d-7660-954c-b3ce7d8ef7d2
- Section: CHEF — Draft Pro (3b3f2bf5-2939-484d-a6a6-655ae70f4039)
- Base: 4476fb90f (octoberBranch); user checkout left unchanged.
- Integration: codex/draft-pro at /Users/tim/.codex/worktrees/draft-pro-chef/fhfhockey.com
- Yahoo one-time heartbeat: yahoo-draft-pro-readiness, September 11 09:00 Eastern.
- Status: orchestration setup; no application implementation accepted yet.
- External checks pending: isolated DB availability, Stripe test credentials and merchant setup; never print secrets.

Task registrations and Chef decisions follow below.

## Registration checkpoint

| Order | Model / reasoning | Client setup ID | State |
|---|---|---|---|
| W01 | gpt-5.6-terra / medium | client-new-thread:3cb4bb34-0eb3-4e53-9d32-3af3869e2e3a | Released on setup completion |
| W02 | gpt-5.6-terra / medium | client-new-thread:2f35a485-4532-42a5-aadb-729df4a7453f | Queued; awaiting release |
| W03 | gpt-5.6-terra / medium | client-new-thread:059ec6e7-e343-4e1c-8123-ddca76efaf4a | Queued; awaiting release |
| W04 | gpt-5.6-luna / medium | client-new-thread:bdd78597-ea08-4258-86f4-42ed91693000 | Queued; awaiting release |
| W05 | gpt-5.6-terra / medium | client-new-thread:2903d74c-8381-4a20-a947-cf035a94e4f0 | Queued; awaiting release |
| W06 | gpt-5.6-terra / medium | client-new-thread:bae14b8d-73b4-4f86-8a5e-0610816bdd5e | Queued; awaiting release |
| W07 | gpt-5.6-luna / medium | client-new-thread:f81d6b9e-424b-4e4f-8b8b-a311da32f65d | Queued; awaiting release |
| W08 | gpt-5.6-terra / medium | client-new-thread:0a6ea4f5-e1e6-49ee-ab34-5868c83cea87 | Queued; awaiting release |
| W09 | gpt-5.6-terra / medium | client-new-thread:74c50f77-b32d-4586-8862-e4cc41f2b9a9 | Queued; awaiting release |
| W10 | gpt-5.6-luna / medium | client-new-thread:ae41cf24-59a8-4dff-ab40-270e7f749cca | Queued; awaiting release |
| W11 | gpt-5.4-mini / medium | client-new-thread:cf3a48c7-fbcc-45ab-a27d-957aa0812eb1 | Queued; awaiting release |
| W12 | gpt-5.6-terra / medium | client-new-thread:89040bc2-f0f7-4db3-8a71-643705f9eb19 | Queued; awaiting release |
| W13 | gpt-5.4-mini / low | client-new-thread:3f937164-88f2-4c53-89e6-997771a9f03b | Queued; awaiting release |

App worktrees exist but list_threads has not yet returned persistent IDs. Next Chef continuation must resolve W01–W13 by exact title, move each into section 3b3f2bf5-2939-484d-a6a6-655ae70f4039, record task IDs, and wait for W01. Do not create duplicates. Emit pending created-thread directives to surface queued setup.

Environment: Node 22.11.0 and existing web/node_modules available; Docker running. Existing supabase_*_fhfhockey-super-goal-baseline belongs to another effort; do not reset/mutate it. Port 54322 also has an SSH listener; do not assume localhost is isolated. Provision a distinct isolated test database/container for this project. Stripe and Patreon configuration keys absent from root web/.env.local; Resend key present (no values exposed). No application changes accepted or runtime tests executed yet.
