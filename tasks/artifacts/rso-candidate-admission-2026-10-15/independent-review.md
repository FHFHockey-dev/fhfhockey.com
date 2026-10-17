# Independent review — retained Yahoo candidate cache scope

Verdict: **ACCEPT the exact frozen four-path increment. No actionable findings.** This is a bounded candidate-position lookup correction in the existing provisional retained-Yahoo path, not acceptance of TJ's actual runtime, league ownership, schedule/rule completeness, qualified forecasts or release readiness.

Integrity: checked every intake before copy against before.json, reconstructed all four change.patch files byte for byte, and matched current candidate.sha256. All15 source/test/dependency input hashes match the identical before/after verification inventories and the current files. Existing dirty baseline changes are preserved; no endpoint, backend reader, shared forecast, planner, worker runtime or persistence source is modified by this patch.

The caller now includes numeric canonical retained-roster, catalog and manual-player IDs. Deduplication and the240 cap happen with retained-roster priority before the hook sorts the selected IDs for cache identity. The overflow message accurately discloses unchecked scope; the sorted request order does not change which roster IDs survive the cap. Cache-only scope remains enabled for Yahoo retained fallback with planning data, while manual, matching live-provider and saved-view precedence retain their existing behavior.

The hook performs at most four sequential requests of60 IDs per selected scope, preserving the existing route limit. It rejects foreign/duplicate response player IDs, mismatched season/source/scope, invalid/expired receipt clocks and different source-cycle expiry strings; partial/error batch outcomes do not become ready aggregate coverage. Shared in-flight deduplication and stale-key/season response exclusion remain in place. This is a per-scope bound, not a process-wide concurrency guarantee or new total client timeout. The unchanged server reader allows at most five DB queries per request with its existing eight-second deadline; no provider calls or writes are introduced.

The existing cachedYahooPlayer guards still check exact NHL identity/class, valid positions, current daily source cycle and original per-player asOf, and preserve already verified manager inputs. The live snapshot remains authoritative. The retained snapshot still withholds league availability/drop/reserve authority and preserves partial roster/rule/schedule evidence. Requesting public default positions neither establishes Yahoo league ownership nor fills acquisition timing, cost, budget/reset windows or missing schedule inputs. Players outside this cache scope receive no cache upgrade; existing explicit manager verification is not revoked.

Verification reviewed, not rerun: final-tests.log shows12 focused offline tests passed and196 unrelated main-component cases skipped. Relevant cases cover180-player sequential batching, foreign-player/mixed-cycle rejection, partial limitations, oversized-scope denial, deduplication/late season, pause/empty, expiry/refresh, actual candidate-cache adoption while availability/acquisition timing remain unknown,240-scope overflow/roster priority and live-provider precedence. The source trace is consistent with the demonstrated caller and60-ID route defects. red-observation.json explicitly contains author observations of two pre-fix failures rather than raw retained logs; this distinction is preserved. Scoped ESLint has zero errors and three dependency warnings; warning messages match lint on the exact intake copy (line offsets changed only).

No test, compiler/build/server/browser, owner account/storage/profile, SQL/network/provider/production, model/pilot, Git publication or deployment action was performed by this reviewer. Only this report was written. No claim is made that TJ's180 candidates will qualify after this correction. Their current provider/path, source-cycle receipts, availability, complete schedule, manager rules and real account acceptance remain unobserved or separately gated.

Exact reviewed evidence SHA256:

- candidate.sha256: `4f39e2e08f5eb677a15b2bd34e484e40cb153f016e4fcd0b39f22f8b88f0f71b`
- before.json: `b28f96acfe69591ee86f9aaf5aa57031514d6986a1acc7b3723baca5d9e9c15e`
- change.patch: `b3d0e790f77d571beeb27b5f20b44f365feab99d3ecf494a16e5b74817f6ea2e`
- receipt.json: `048aba2378db7b269f838e94d0f6946fb1d5a1da8022e540b6f2a77888d42e55`
- final-tests.log: `4bccc9d1748cd8405e9e29daca2032e768aa401633a51a40ea4611d301143576`
- lint-before.log: `8dcc4818442768406343e6a3fcf5074298ba7b9f7ffccdf3d839c75d4ae5a400`
- lint.log: `65e30339da9362757c4738f79810c299f78560036879fa6f7506bbc47e700018`
- verification-inputs-before.json: `6f8d89a6e485323a3cad3b1aa1d14f4a5b8af5c83ab9c2d63609f5ab8157302c`
- verification-inputs-after.json: `6f8d89a6e485323a3cad3b1aa1d14f4a5b8af5c83ab9c2d63609f5ab8157302c`
- red-observation.json: `bc9a4131ace122128e0d2834d553b44c6c671cdd912b1407a00610a73dd19094`
- INPUT-TRACE-AND-ACCEPTANCE.md: `2821e97fc88d390e8afb3f57846d13a9e830cd843068af19c4af774ea8a9f727`

Accepted current source/test SHA256:

| Path | SHA256 |
| --- | --- |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `d13dac954bb9998368249bebb71a4a737c14c38a5a39abd2aae2f3bbe651f0e6` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `b06810f3a1150aba29740cdfd059618b60b105abccd6c275f93e9b49cc235c9c` |
| `web/hooks/useYahooEligibility.ts` | `5a8ff56cd3cf1896a0e7ed2d23f0eb103169d7362ed8aa17f7baaf430831cca0` |
| `web/hooks/useYahooEligibility.test.tsx` | `2e5653b677953dfe411f714ca5aad7aee1209a68145bbe38c3d8e332124821a2` |
