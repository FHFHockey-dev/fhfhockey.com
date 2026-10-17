# Native run admission increment

Base: `octoberBranch` at `a8f58de6178e282acd3a71851c66f4a56b119f14`, after synchronization confirmation.

Only `web/lib/projections/apiHelpers.ts` and its direct test were changed. The latest-run query now reads metrics and requires `external_fantasy_input_contract=excluded_from_native_inputs_v1`. A selected legacy/unsupported run returns 422, so existing callers that fall back only on 404 do not treat it as missing. Missing run identities still return 404; database errors are preserved. This serving check does not add calibration's separate rolling-history requirement.

[additional.diff](additional.diff) is the exact increment against the preserved pre-increment files, including the already-reviewed test changes. [receipt.json](receipt.json) records before/after SHA256, patch SHA256, and exact preservation hashes for the six other files in the earlier seven-file patch.

Verification: 26/26 direct tests passed (10 existing, 16 admission tests); scoped ESLint and diff whitespace checks passed. No broad tests or full TypeScript were run for this increment. No consumer/schema/SQL edits, Git mutations, builds, deployments, production requests or model producer runs.

Remaining scope: explicit run-ID and fallback-candidate admission, consumer revision admission, external baseline contribution product admission, and historical calibration lineage. This increment closes only default latest-run admission. The read-only trace in the conversation identifies the relevant owners/boundaries; the earlier report's default-run gap is superseded by this increment.
