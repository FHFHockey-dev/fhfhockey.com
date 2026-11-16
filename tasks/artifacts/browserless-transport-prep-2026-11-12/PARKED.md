# Browserless replacement parked; quarantine guard prepared locally

TJ's parking direction supersedes the earlier TLS/rotation rollout proposal. **Do not implement, restore, release or execute the replacement/TLS/rotation instructions without new Scout/TJ direction.** Historical HANDOFF, IMPLEMENTATION, ROLLOUT and APPROVAL-SUMMARY documents remain evidence, not active instructions.

The exact eight-file transport candidate is preserved in `parked-candidate.patch` and `parked-candidate.tar.gz`, with hashes in `QUARANTINE.json`. Every archived file matches its reviewed source pin. The patch reverse-check passed before removing only that owned delta from the shared checkout. Transport files, diagnostic extensions and four manifest declaration lines are now absent from the active diff. Existing baseline redaction remains byte-for-byte unchanged. No installs, index/ref changes or unrelated work were touched.

The active local candidate is only:
- `web/pages/api/v1/webhooks/on-new-line-combo.ts`: fixed, authenticated HTTP 200 `{success:true,status:"skipped",reason:"line_combo_webhook_parked"}` before query parsing, logging, retry, Browserless, storage or Discord work. The source guard has no environment/request override.
- `web/__tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts`: five offline guard cases with the real auth wrapper and mocked external clients. They prove the fixed skip response for missing/plaintext/secure endpoint settings, return before query access, retained unauthenticated rejection, zero downstream effects/logging/retry timers. Prior active transport tests remain in the archive and baseline tests in Git.

`guard-candidate.patch` and `GUARD-CHECKS.json` pin the local guard. All 18 focused tests passed (5 guard + 13 unchanged redaction), scoped lint and typecheck passed. No full build, live handler check, provider/DB request, deployment or operational change occurred. Authenticated user verification may still use the unchanged auth middleware; the quarantine prevents the webhook's screenshot/storage/Discord work, not authentication itself.

`TRIGGER-PLAN.md`, `trigger-preflight.sql` and `trigger-set-mode-plan.sql` prepare targeted database quarantine and exact-mode rollback. Claude holds the DB window; no live state/clearance was supplied. Scout must coordinate that window and approve the exact production operation. Neither trigger disablement nor deployed handler quarantine has happened. No claim that traffic to the old host has stopped.

Outstanding risks: last saved remote endpoint used plaintext ws with a query token; active credentials/host operator remain unverified, tracked Compose contains a literal TOKEN of unknown active status, and historical logs are not retroactively sanitized. Disablement does not cancel in-flight/queued work or alternate callers. Skipped events will not create images or Discord notifications and are not automatically replayed. Host decommissioning, credential rotation, TLS/replacement work and provider validation stay parked for later explicit direction.

Restore only by explicit resumption and fresh exact ownership: validate the saved archive/patch pins, reconcile with current source/manifests, and apply only accepted changes. Never unpack the archived manifests over later shared edits or blindly apply the old whole candidate. Keep diaries/artifacts outside release scope.

Serial-window continuation: [APPROVAL-PACKET.md](APPROVAL-PACKET.md) and [RELEASE-SCOPE.json](RELEASE-SCOPE.json) define the proposed release, trigger transaction, rollback and verification budgets. [SERIAL-STATE.json](SERIAL-STATE.json) records acknowledgment/read clearance. The request is delivered through the established Claude handoff; no Browserless slot is allocated yet.
