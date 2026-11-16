# Mutation checks on `convert.mjs` (2026-11-15)

**Where:** run only in a scratch mirror (`repro/mutate.sh`), never on the bridge folder. Each mutation edits one line, then runs the matching tests with `--test-name-pattern`. Afterwards, `convert.mjs` was restored and confirmed byte-identical to the bridge copy with `cmp`.

| Mutation | Tests run | Result | Meaning |
| --- | --- | --- | --- |
| Drop the `checkRuntime(...)` call | "negative TLS" (tests 4, 5) | **caught** (test 5 fails) | The bridge-only `runtime_default_ca_store_not_bundled` and node-pin cases detect it. |
| Drop the `verifyTlsChain(...)` call (author's claim) | "negative TLS" | **caught** (test 5) | Confirmed. |
| Drop the 8-day term (author's claim) | "stale" (test 9) | **caught** | Confirmed. |
| Drop the `date < retrieval day` term | "stale" | **caught** | Confirmed. |
| `< 8 days` changed to `<= 8 days` | "stale" | **SURVIVES** | No test sits on the exact 8-day boundary. The suite's stale case is 8 days plus 31 s. My `repro-convert.mjs` case `exactly_8_days` covers the boundary, and the unmutated code refuses it correctly. |
| Drop the TRANSPORT-OBSERVATION mirror check (`tls_observation_inconsistent`) | "negative TLS" | **SURVIVES** | Masked: the successor verifier vetoes the same packet first (`provenance_tls_mismatch`), and the test's regex accepts either code. The bridge rule is redundant with the pinned verifier, not wrong. |
| Drop `obs.TLSVerified === null` (`observation_overclaims_tls`) | "negative" (8 tests) | **SURVIVES** | No test targets it, and the verifier's `provenance_overclaims` vetoes the same case. Redundant defence in depth. |

**Takeaway:** the author's two claimed mutations are real. Three bridge rules are covered only through the pinned verifier, or not at all at the exact boundary. Add direct unit assertions for the mirror check, the overclaim check and the exact 8-day boundary, so the bridge does not silently depend on which verifier is passed via `--verifier`, an unpinned input like `--pins`.
