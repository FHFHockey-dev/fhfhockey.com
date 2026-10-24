# Sandbox billing migration placement — local correction complete

**Applied: relocated the unchanged local draft outside the active migration directory, without
registering it as canonically approved.** The billing owner confirmed that approval covered local
authoring and disposable sandbox execution only, not admission into the supported migration chain.

## Reproduced state

- Checkout: `octoberBranch`, HEAD `a565238f670edc4cf65da79ad52ba82ec41f3b71`.
- Commit `fd58ba2452c0175b201e50285df156cb7f91b4f4` added the 274-line SQL file without an authority
  record. Current bytes match that commit and the isolated SQL receipt.
- File SHA-256: `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`.
- Actual offline command from `web/`:
  `npm test -- lib/supabase/supportedBaselineMigration.test.ts --run --reporter=default`.
  Result: **20 passed, 1 failed**, exit 1. The sole failure at line 65 is 99 active SQL files versus
  98 authority rows; the billing draft is the only extra filename. No SQL or database call ran.
- The active authority/test/summary and billing source paths were clean when inspected.

## Minimal reversible correction

[PROPOSED-RELOCATION.patch](PROPOSED-RELOCATION.patch) was applied exactly after fresh hash/status
checks and parent authorization. Dry forward/reverse checks passed. It contains:

1. A 100% identical-content rename from
   `supabase/migrations/20261021210000_in_season_sandbox_billing.sql` to
   `tasks/artifacts/in-season-billing-2026-10-21/drafts/20261021210000_in_season_sandbox_billing.sql`.
2. Path-only updates to the four executable consumers:
   - `web/lib/in-season/monthlyIntegration.test.ts:365`;
   - `tasks/artifacts/in-season-billing-2026-10-21/LOCAL-SQL-CHECK.cjs:51`;
   - `tasks/artifacts/in-season-billing-2026-10-21/LOCAL-AUTH-CHECK.cjs:49`;
   - `tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs:53`.
3. A short current-location/provenance note in the billing `REPORT.md`.

The authority JSON, supported-baseline test assertions, canonical summary and all 98 supported
migration hashes/orders/states remain unchanged. Removing only this misplaced draft from the
active filename set restores exact authority equality in the offline set comparison. Historical
receipts, hashes, patches and manifests retain their original paths; the new note maps those
paths to the retained draft for current hash checks rather than rewriting old evidence.

Final verification passed **84/84 tests**: all 21 supported-baseline tests and all 63 fixture-backed
monthly integration tests. Each artifact harness passed `node --check` without executing it.
The focused whitespace check passed. The exact reverse-patch dry check proves the resulting
changes match the prepared patch; source-hash checks confirm the SQL, authority, baseline test
and canonical summary are unchanged in content. See [test receipt](FINAL-TEST-RESULTS.json),
[exact before/after pins](CHANGED-FILES.json), and [verification record](EVIDENCE.json).
No database, source-admission, commit, push, migration execution or deployment occurred.

## Why registration is not the correction

`AUDIT-TASK-006.1` requires an owner-reviewed class/hash/order/deployment gate and says to make no
source classification change until approved. Source presence or the sync commit does not supply
that approval. The billing owner's disposable-loopback receipt is not canonical admission or a
Production application receipt.

If TJ instead wants canonical retention, the missing decision is explicit source admission for
this exact hash, its reviewed class, sorted source order 97 and rollout gate. Existing orders
97–98 would become 98–99, with consistent inventory/count documentation. Without an exact
Production receipt, `unknown` is the conservative deployment classification. This option creates
more documentary change and would deliberately retain a sandbox-only schema in the canonical
replay; it is not recommended merely to make the test pass.

The parent authorized this reversible local correction after coordinating with the billing owner.
No authority registration or SQL content change was made. No action was denied by approval review
or left with uncertain execution. The local regression is resolved; admission, application and
release remain separate decisions.
