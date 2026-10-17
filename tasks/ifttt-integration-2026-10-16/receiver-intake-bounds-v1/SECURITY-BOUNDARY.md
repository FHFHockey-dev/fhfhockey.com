# Local privilege and failure boundary

SQL7 deliberately makes the SQL6 core private to the migration owner and exposes one bounded write gateway to the existing server service role. It adds no identity provider, credential or role. Owner-only registration is distinct from application intake; environment input cannot register a contract.

| Actor | Register/widen/reset | Bounded retain | Stop | Read policy/admissions/archive | Direct archive mutation/core RPC |
|---|---|---|---|---|---|
| migration owner | exact future registration only; frozen repeats accepted | yes | yes | yes | owner powers remain an operational trust boundary |
| service_role | denied | exact registered policy/scope/window/budgets | monotonic stop only | SELECT | denied |
| anon/authenticated | denied | denied | denied | denied | denied |

The retain and stop functions use SECURITY DEFINER intentionally for this narrow privilege separation, not to work around a failed request. Their search_path is empty, references are schema-qualified, the raw table is selected only from a registered allowlisted tuple, and dynamic values are parameterized. PUBLIC/anon/authenticated execution is revoked explicitly. This is an internal service API, not an auth.uid()-owned user-record API; no client JWT metadata is used as authority. Deployed ownership/RLS/inherited grants, schema CREATE privileges and every trigger still require separate inventory/advisor review. No hosted advisor was run.

The service role retains the existing raw table privileges used by other application paths. SQL7 does not claim universal fencing of those legacy/direct writers. The controlled receiver cannot use its own fallback once pilot intent is present; deployment/configuration consistency remains a prerequisite.

The transaction snapshots an existing carrier before its first quota update, reuses SQL6's per-key lock and existing-key INSERT avoidance, and verifies full persisted policy/raw/archive/admission rows after the last mutation. Ordinary inner faults roll back retained work while charging the attempt. A quota-trigger mutation before that inner savepoint causes whole-transaction failure/rollback. No background mutation or automatic second call is attempted after a failed/uncertain reply. Deferred commit-time triggers and arbitrary later writers remain outside the reviewed post-statement boundary.

Only scoped local tests were run. No broad tests/compiler/build, deployed ACL check, HTTP receiver request, policy registration, stop or activation occurred against any hosted system.
