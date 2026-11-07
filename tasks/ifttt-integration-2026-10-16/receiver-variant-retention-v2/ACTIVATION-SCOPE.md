# Remaining activation boundary

This note is outside the frozen 29-artifact correction checkpoint. No source pin changed and no flag was enabled.

`IFTTT_RECEIPT_VARIANTS_ENABLED` is currently one server-wide switch for known-ID requests to configured receivers. It has no implemented per-source allowlist or receipt-count/time cap. Unknown-ID storage remains on the prior path. The future-evaluation cohort's limit of 25 samples per 24 hours is separate and must not be presented as a raw-receiver intake cap.

The earlier approval package asks for a bounded natural-receipt canary. That remains a **real prerequisite**, not an implemented property of this flag: before activation, establish an approved, enforceable source/count/time boundary or explicitly approve the actual broader flag scope and its traffic/storage budget. If existing operational routing cannot enforce the intended bounds, a separate bounded intake-control increment is needed before enabling it. This correction does not authorize changing routes, IFTTT delivery settings, project flags, schedules or credentials to create such a canary.

The canonical/raw processing switches are independent. Enabling evidence retention must not silently enable processing/dispatch or change existing canonical processing authority. Held variants create no additional raw carrier or processor request. Authenticated edit/revision/supersession handling remains separate from preserving an observed variant.

Apply neither SQL6 draft until exact candidate/migration authority, deployed schema/privilege/trigger/fencing proof and operator approval are complete. Select only the corrected SQL6, preserve archive evidence on rollback, and retain the sender/hosted-RPC/external-queue and genuine prospective-performance gates.
