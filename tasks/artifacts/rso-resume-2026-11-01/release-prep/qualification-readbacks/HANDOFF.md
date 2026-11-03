# Offline qualification integrity supplement — 2026-11-01

Implemented and tested in this isolated artifact directory. The retained FORGE-QUAL files, frozen four-file RSO candidate and admission catalog were not changed.

**Latest checkpoint:** the downstream microsecond-ordering P2 is now corrected and ready for independent re-review. See `microseconds-review/HANDOFF.md` and its hash-bound evidence. The checker reuses the production strict timestamp parser via the existing web/ts-node installation; all chronology comparisons preserve microseconds. This dependency and the retained-file allocation requirement are documented there. No installation occurred.

The previous checker could return `pass: true` with no issued rows, with a required consumer omitted entirely, or with sealed issued/readback rows when no sealed settlement was supplied. Its CLI also allowed `--sealed` to override the frozen scope. Those paths now fail closed. Sealed issued rows are excluded from comparison and settlement; independently dated sealed readbacks are rejected. This detects forbidden evidence in a local input file; it cannot undo or authorize a prior read.

The current supplement also rejects scoped readbacks with a missing/invalid capture timestamp, and any readback captured at or after puck drop. Both paths previously passed despite matching values. These are minimum chronology guards; they do not establish exact T−60 execution or introduce a new timing tolerance. No scientific scope or threshold changed.

`source.patch` targets exactly the existing checker and its test under `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/`. Source pins and results are in `EVIDENCE.json`. Preserve its retained FORGE-QUAL custody: apply only after allocation, and do not fold these working artifacts into the app release candidate.

Verification:

- New regressions against the unchanged checker: 14 passed, 5 failed (`baseline-tests.log`).
- Initial corrected checker: 19 passed, 0 failed (`tests.log`).
- New capture-clock regressions before the fix: 19 passed, 2 failed (`capture-clock-before.log`). That checkpoint passed **21 tests** (`capture-clock-after.log`). The subsequent precision checkpoint passes **28 checker tests under each timezone**, plus adapter/CLI/import-dependent flows; see `microseconds-review/after.json`.
- `git apply --check source.patch`: passed against the still-pinned canonical files (`capture-clock-patch-check.log`); patch not applied.
- Frozen scope copied byte-for-byte; protocol hash remains `49ae034acc864a291393dc27e86cc745697ca83e18cc2f9666508f07db46a4ef`.
- Four advertised RSO source pins are unchanged in the reconciled #403 candidate tree `394e3cb70d3e9995e8a1f02f75ba13973320df34`.

Run from repository root:

```sh
node --test tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-readbacks/tooling/check-readbacks.test.mjs
```

These are synthetic integrity tests, not prospective forecast qualification. The copied real scope remains `draft_identity_unpinned`. This checker does not compute the 14-slate accuracy metrics or approve forecast uses. No RSO review, producer identity, live capture, deployment or activation was created. No network, database, provider, build or Git mutation occurred.
