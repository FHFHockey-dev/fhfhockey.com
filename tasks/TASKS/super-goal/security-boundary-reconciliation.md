# Security Boundary Reconciliation (6.3)

**Status:** Evidence-only verification completed 2026-07-31. This artifact classifies the current authentication, entitlement, RLS, secret, view/function, storage, and user-data boundaries. It does not authorize a migration, writer, repair, backfill, provider call, credential change, deployment, or deletion.

## Conclusion

The inspected application and database contracts have explicit admission boundaries and no newly discovered contradictory public writer or privileged-reader path. Missing or invalid route credentials fail closed; service-role SQL and protected state tables are not browser surfaces; callback and local-auth cleanup remove credential-bearing URL/storage state; account linking is not treated as a feature entitlement. The current value-free Production receipt confirms the public/denied split for representative routes (`/auth`, canonical reads, the administrator-required `/db` shell, unauthenticated Sustainability rebuild, and unauthenticated webhook access).

This closes master verification task 6.3 as an evidence-reconciliation task only. The open gates below remain open in their owning lists and are not implied complete by this matrix.

## Boundary matrix

| Boundary | Evidence inspected | Current disposition |
| --- | --- | --- |
| Browser authentication and callback state | `web/lib/supabase/browser-auth.ts` uses the PKCE browser flow and selectively clears only matching Supabase/FHFH auth storage keys. `web/lib/supabase/auth-callback-location.ts` scrubs access/refresh/provider tokens, codes, hashes, state, and errors before asynchronous work and accepts only safe same-origin return paths. Auth callback/reset/AuthForm tests cover the behavior; the local Google and disposable confirmation/recovery runs ended in credential-free authenticated/reset states and were cleaned up. | Fail-closed local behavior is evidenced. Hosted template compatibility, guarded Production Google/sign-up/recovery publication, and legacy-fragment retirement remain explicit gates. |
| Admin and cron route admission | `web/utils/adminOnlyMiddleware.ts` rejects blank/missing secrets, accepts the exact cron bearer only, and otherwise requires an authenticated Supabase user with the `admin` role before attaching service-role access. `web/lib/cron/withCronJobAudit.ts` records bounded status/timing/row/error metadata. Focused auth-boundary tests pass, and the current Production receipt shows missing/invalid mutation auth as `401` while public reads remain available. | Admission is fail-closed and auditable. Route-specific natural-run, scheduler handoff, and complete Production acceptance remain open where listed by the cron/Sustainability/DRM tasks. |
| Secrets and provider credentials | Cron-secret hardening is documented as value-free and the service-role/provider-token contracts are Vault/service-only. No secret values are copied into this artifact or logs. | Repository/runtime boundary is classified; legacy mailbox plaintext-candidate containment, IFTTT historical-key invalidation/current-key proof, and other provider retirement gates remain open. |
| Entitlement and account ownership | Patreon is explicitly account-linking-only, with no concrete feature grant inferred. Draft Ranker owner-scoped/RLS contracts and signed-out denial behavior preserve private ownership; public aggregate rollout remains off. | No entitlement escalation was found. Provider lifecycle and any future feature-entitlement decision remain separately owned and are not inferred from linkage. |
| RLS and user-owned state | The inspected Yahoo snapshot/week, atomic writer, legacy-writer restriction, sKO run-control, and related migrations force RLS or grant privileged access only to service-role paths. Local disposable-stack replay and ACL/RLS tests cover the current migration chain; hosted catalog/REST evidence is value-free. | Browser-denied/service-only state boundaries are evidenced for the inspected surfaces. Full hosted schema/config parity and any remaining table-specific advisor/retention checks remain open where named. |
| Views, functions, and schema exposure | Ordinary public readers are security-invoker; privileged/intermediate surfaces and tombstoned RPCs are browser-denied/service-only. The unified materialized aggregates are moved behind non-exposed `internal_stats` storage with canonical select-only wrappers. Direct browser calls to protected surfaces return denial/406 in the recorded value-free checks. | No new public privileged function/view was found. Tombstoned RPCs still require one-release zero-use monitoring/final-drop authorization; retained Yahoo-cache postdeploy/advisor disposition remains a separate gate in the current checkpoint. |
| Storage and browser-resident state | Auth reset deliberately removes matching auth keys while preserving unrelated UI state; player/Draft settings session storage contains UI state rather than provider secrets. The webhook route is auth-protected before work and has an application-bound screenshot upload path. | No public storage grant was inferred from source inspection. `storage.objects` policy/retention proof is not complete in this cohort and remains an explicit follow-up; no screenshot, upload, Discord call, or webhook writer was executed. |
| Public, legacy, and diagnostic surfaces | Value-free Production probes show `/auth` and canonical reads `200`, the signed-out `/db` administrator shell `200`, unauthenticated Sustainability rebuild `401`, and unauthenticated webhook `401`. Noindex/quarantine contracts keep retained legacy routes from presenting themselves as trusted canonical writers. | Public/denied behavior is classified for the representative boundary. Remaining legacy-route retirement and operator-only diagnostics stay attached to their source tasks. |
| User-data lifecycle and cleanup | Disposable auth confirmation/recovery cleanup verified zero remaining auth/profile/settings rows for the temporary identity. Owner-scoped imports and Draft Ranker state use authenticated ownership checks and idempotent contracts; callback/reset paths avoid retaining visible credentials. | The tested lifecycle is bounded and cleaned. Legacy mailbox retention, provider disconnect/rotation, historical data repair, and any destructive cleanup require their existing owner authorization. |

## Security invariants retained

1. Missing, malformed, or unauthorized route credentials produce denial before privileged work; public GET behavior is not used to infer mutation permission.
2. Browser-visible readers and service-only writers are separate contracts. A compatibility adapter or UI wrapper does not gain write or privilege authority by being importable.
3. Service-role, provider-token, and cron-secret values are never copied into source-controlled evidence, browser payloads, URLs, screenshots, or logs.
4. Account linkage is not entitlement. Owner and RLS checks remain required for user data and private analytics.
5. Historical/provider/retirement state is never inferred from a static source scan or a value-free read; those actions retain their explicit gates and receipts.

## Explicitly not closed here

- Hosted Supabase template `{{ .RedirectTo }}`/PKCE compatibility and guarded Production lifecycle proof.
- Legacy mailbox credential inventory/containment and broad credential-retention decisions.
- IFTTT historical-key invalidation, old-key rejection/current-key authorization, payload repair, and controlled events.
- Yahoo provider/league discovery, historical backfill, Python-owner retirement, and retained-cache revocation/advisor disposition where still gated.
- One-release tombstoned-RPC zero-use monitoring and final drop.
- Complete `storage.objects` policy/retention verification.
- Sustainability/FORGE/DRM history repairs, scheduler natural runs, and any business writer/backfill.

## Evidence references

- `web/utils/adminOnlyMiddleware.ts`
- `web/lib/cron/withCronJobAudit.ts`
- `web/lib/supabase/browser-auth.ts`
- `web/lib/supabase/auth-callback-location.ts`
- `web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts`
- `web/__tests__/pages/api/v1/db/projection-materialization-auth.test.ts`
- `web/__tests__/pages/api/internal/cron-auth-check.test.ts`
- `web/__tests__/pages/auth/callback.test.tsx`
- `web/__tests__/pages/auth/reset-password.test.tsx`
- `web/lib/supabase/auth-callback-location.test.ts`
- `supabase/migrations/20260725220704_reconcile_yahoo_player_key_snapshots.sql`
- `supabase/migrations/20260723113533_make_yahoo_player_writer_atomic.sql`
- `supabase/migrations/20260723040553_restrict_legacy_yahoo_player_writers.sql`
- `supabase/migrations/20260730195000_replace_yahoo_game_weeks_snapshot.sql`
- `supabase/migrations/20260731040341_privatize_unified_materialized_views.sql`
- `tasks/TASKS/super-goal/super-goal-final-summary.md` (current value-free Production receipt)
