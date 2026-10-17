# Independent review v2 — legacy strict shape correction

Verdict: **ACCEPT the exact two-file correction. No remaining findings in this delta.** The initial seven-file review and its scope remain historical; this sidecar additionally accepts restoration of strict legacy key rejection.

Verified the preserved accepted-v1 seven source copies and candidate manifest/patch/verification/report against their original hashes. Reconstructed strict-shape-correction.patch against those accepted copies and matched both reviewed strict-freeze files byte for byte. The initial root independent-review.md and archived report remain unchanged at SHA256 `c8dd164a430e6dc9b6d79aa3c4de498225a24cc8a54b771914d1fc5ad52219cc`.

At contributionStore.ts:129–130, an enumerable own gameId or scheduledAt key is again rejected for non-scoped policies, including explicit null keys that the preceding accepted increment had inadvertently allowed. The new scoped SOG policy retains its separate required game/start validation; ordinary legacy sources without those keys retain the prior contract. Canonical candidate hashes, release/approval/use permissions, time checks, persistence default and public sanitization are untouched by this correction.

The two regressions first build otherwise valid, correctly checksummed legacy bundles, remove both scoped keys, then independently add each null key. They require the specific invalid-bundle error, with DB access forbidden. They would fail on the preceding permissive candidate; neither unknown-field checksum mismatch nor a DB failure substitutes for shape rejection. Retained strict-shape-verification.json records29/29 adapter tests and two-file lint exit0. These checks were not rerun by this reviewer.

No application edits, tests, compiler/build, genuine source/outcome reads, producer/model execution, network/provider/account/DB or publication action was performed. The separately owned contributions.ts clock correction is reviewed in its own report; it is not folded into this two-path acceptance.

Evidence SHA256:

- strict-shape-correction.patch: `fc940f5419cb048110e3e1a3ac20c606a53f0f52f228b751b48084debf21d510`
- strict-shape-correction.sha256: `a66bb1b038031fa96e957db3ffde2c0831699c2205bfcbd0cb96651c8afa20df`
- strict-shape-verification.json: `6441fab833f0239e7a53b437bfc4c0b24009cd33c3021e99a1f738e0140da97f`

Accepted correction pins:

| Path | SHA256 |
| --- | --- |
| `web/lib/player-forecasts/currentSeasonSogContribution.test.ts` | `8317d0b812a34f861b37e76f159e883a25774b529eb85e258dc2c285b5fc4a6c` |
| `web/lib/player-forecasts/contributionStore.ts` | `a890ffccf09bac914201be46f6af1325b9a1651309cd6ee8ade00f7c2241ca7b` |

## Subsequent fixture annotation readback

**ACCEPT the separately frozen one-file type annotation delta.** During final pin readback, the adapter test moved from the strict-shape pin above to the following pin. The author supplied the preserved preceding bytes and exact type-fixture-correction patch; both were independently verified. The strict-shape source remains unchanged at `a890ffccf09bac914201be46f6af1325b9a1651309cd6ee8ade00f7c2241ca7b`.

The only subsequent changes import CurrentSeasonSogContributionInput as a type and explicitly annotate the fixture binding/input. No assertion, runtime statement or application source changed. This resolves the fixture's overly narrow inferred season literal and widened version type. The retained verification records eight initial fixture diagnostics and replacement scoped semantic compilation exit0, zero diagnostics,41 project inputs/no drift; that is scoped author verification, not a full-tree compiler result or reviewer execution. No pending final-255 checkpoint is claimed by this report.

Current accepted adapter-test SHA256: `eb6bd88148118b6383579cc24bfdd4582672bb6aab57f81a7fd3540b1b6f6441`.

Annotation evidence SHA256:

- type-fixture-correction/increment.patch: `057398d0c8e602764cc7686d5c8c0165daa978340b7c4b81f50547657994ee5d`
- type-fixture-correction/candidate.sha256: `86cb9046cd2d684514c02befb2c8986c747b591c90a73269d140d5c0692c3798`
- type-fixture-correction/verification.json: `853a0ee0b8241660a06ea4d48ade349f5ca519c2ebb28de175bd46ece0e38edb`
