# Yahoo live-draft production-readiness tracker

Last updated: 2026-08-24. This is local implementation evidence, not a production qualification receipt. The requested `deep-research-report (4).md` was not present in the repository or supplied attachment directory.

| Work item | Status | Evidence / remaining gate |
| --- | --- | --- |
| P0.1 typed provider client | Completed locally | Direct bounded client, standard JSON default, metadata, typed errors, one refresh retry. Provider contract still needs rehearsal. |
| P0.2 dynamic game identity | Completed locally | Discovery and polling require exactly one configured NHL game/season match across Yahoo and `yahoo_game_keys`; hard-coded production key and latest-game fallback removed. |
| P0.3 OAuth hardening | Completed locally | Static callback, opaque one-time DB state, browser binding, S256 PKCE, safe return paths. Target migration not deployed. |
| P0.4 token lifecycle | Completed locally | Initial expiry, proactive refresh, per-account lease, rotation-preserving atomic write, reauth state. |
| P0.5 durable coordinator | Partially completed; deployment-infrastructure blocked | Long-running Node worker and DB leases exist. This repo has no configured durable sub-minute worker substrate. |
| P0.6 browser polling removal | Completed locally | Browser owns Realtime/state GET/nudge only; no provider interval. Rehearsal must prove closed-browser ingestion. |
| P0.7 lifecycle/cadence | Completed locally | Predraft remains pollable, 60/30/12-second tiers, 10-second active default, bounded normal/failure jitter, opt-in 5-second burst, delayed postdraft confirmation. |
| P0.8 destructive snapshot quarantine | Completed locally | Count/player/team/cost/order regressions require a matching second response; only changed/deactivated picks are marked as corrections, and failures retain last good state. |
| P0.9 canonical identity | Completed locally | Pick contract and dashboard resolution are FHFH first, then NHL, then exact seasonal Yahoo; the compatibility view starts from verified canonical identity. |
| P0.10 independent reconciliation | Completed locally | Service-only exact-context reconciliation runs after snapshot application and authoritative state load; the provider hash excludes identity metadata so mapping-only changes do not advance snapshot version. |
| P0.11 schema/type deployment | Partially completed | Additive migration and generated types are local; target deployment and postdeploy regeneration are not authorized or verified. Read-only production policy/index/publication inspection was completed against the prior migration. |
| P0.12 observability | Completed locally | Pseudonymous short-retention observations and due-lag runbook; no raw payload/token archive. |
| P0.13 failure UX | Completed locally | Stale/critical messaging, last sync, reconnect, last good state, attribution, worker nudge, manual fallback, maintenance gate retained. |
| P0.14 rehearsal harness | Harness completed; provider-validation blocked | Sanitized marker/report CLI and operator procedure exist. No controlled Yahoo rehearsal was performed. |
| P1.1 same-league deduplication | Deferred | Requires cross-owner access proof and provider rehearsal; current coordinator caps concurrency and serializes by connected account. |
| P1.2 global/per-account governance | Partially completed | Browser retries removed, per-account serialization/refresh locks, bounded concurrency, Retry-After/backoff/jitter exist. Global configurable governor and circuit breakers are deferred. |
| P1.3 adaptive policy | Partially completed | Deterministic provider/draft-time/unchanged/change-aware policy exists; empirical tuning and cache-header interpretation await rehearsal. |
| P1.4 append-only correction history | Deferred | Current materialized revision/deactivation behavior is retained. Add history only with a defined replay need and retention policy. |
| P1.5 typed discovery adapter | Deferred | Live path is typed; `yahoo-fantasy` remains isolated to discovery but its full adapter is not yet runtime-validated. |
| P1.6 keeper/traded-pick safeguards | Partially completed | Injury-slot diagnostics and explicit prediction labeling exist; keeper/traded-pick semantics require separate provider validation. |
| P1.7 Yahoo OIDC identity | Deferred | Do not request `openid` until app permissions and account-linking model are approved. |
| P2.1 dependency cleanup | Completed locally | Unused direct `oauth-1.0a` removed; transitive `oauth-signature` retained for `yahoo-fantasy`; broad upgrades avoided and audit findings documented. |
| P2.2 Python pins | Completed locally | Existing compatible Supabase/YFPY/dotenv versions are pinned for CPython 3.13; guarded scripts remain separate from Node live runtime and pass disabled-path smoke checks. |
| P2.3 retention/privacy | Partially completed | OAuth and 30-day observation cleanup are idempotent; session/pick/audit/rehearsal retention still needs product/legal policy. |
| P2.4 Yahoo documentation | Completed locally | Schema, identity ownership, worker, Realtime, retention, gates, rehearsal, and rollback are documented. |
| P2.5 adjacent backlog | Completed locally | See `yahoo-live-draft-backlog.md`; no adjacent feature entered live-draft scope. |

Release decision: **NO-GO for broad production rollout**. Keep `YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED=false`, the rollout stage `off` outside an authorized staff/allowlist rehearsal, and the production maintenance modal intact.

Dependency evidence: `npm audit --omit=dev --json` reports 13 production-tree findings (7 high, 6 moderate, 0 critical). The Yahoo-specific finding is the old transitive `uuid` bundled by `yahoo-fantasy`, with no available fix. The direct live polling/OAuth path does not import `yahoo-fantasy`; it remains discovery-only pending P1.5. Other findings are existing Next/PostCSS/Sharp/Puppeteer paths and require a separately scoped upgrade.
