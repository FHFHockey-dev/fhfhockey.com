# RSO reconciliation after PR #402 — 2026-11-01

**Use this checkpoint instead of the old-base release request.** PR #402 changed the release base and producer closure. The four RSO repairs/tests remain unchanged and apply without conflict. No canonical application or admission source, Git index/ref, deployment or activation was changed by this reconciliation.

## Confirmed state

- GitHub's read-only PR metadata confirms [#402](https://github.com/FHFHockey-dev/fhfhockey.com/pull/402) merged at **18:20:47 UTC**, commit **`f17bea20d8caa2b6268c318bdb2152d7e2a3b57d`**. Saved `origin/master` matches. Evidence: [PR402-UPSTREAM.json](PR402-UPSTREAM.json).
- Observed canonical `octoberBranch` HEAD: `50f4e9aaede4b2b40b673ea16b73e2be17d6c057`. It includes sync `ad8a2c34c` from #402 and later Social Share commits. The local `master` ref is still the October-15 `457435eb3`; it was not moved. The later HEAD commits do not change the scanned producer closure.
- The prior Social Share freeze predates the release. The newer Claude chef diary records #402 and reports the main deployment READY, other three canceled. Those are owner-reported deployment results; this task did not independently inspect Vercel or application runtime. The PR description says FORGE v2 code was included, its page returns not-found and its migration was not applied. Code merge is not activation evidence.
- No reply or custody transfer arrived in the incoming Claude mailbox. PROV-GUARD/local Git custody remains retained. The initial corrective **HOLD** on the old request was followed by the parent-authorized replacement custody request at **19:24:57 UTC**, with the exact new base/tree and committed #402 receipt. No commit or release has occurred in this lane.

## Replacement proposal

| Item | Identity |
| --- | --- |
| Selected base | `f17bea20d8caa2b6268c318bdb2152d7e2a3b57d` |
| Base tree | `92517944c869baef86f6d9a869c5a5ab2992e24a` |
| Proposed base + four RSO files tree | **`9820a239181765a7eae2597c32c0f380c0260b5a`** |
| New release producer closure | `f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92` |
| New four-file candidate closure | **`ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c`** |

The candidate is **not committed, allocated or approved for publication**. [CANDIDATE-AFTER-402.json](CANDIDATE-AFTER-402.json) pins its four files and isolated verification export. [combined-source.patch](combined-source.patch) is byte-identical when produced against the new base; no source repair was needed. The original candidate tree `a77527…` and closure `7083dee0…` stay historical. Following the replacement-request authorization, active `CANDIDATE.json` and `ADMISSION-REQUIREMENTS.json` now pin the new identities; the prior versions are archived as `*-BEFORE-402.json`. The helper's exact-tree check rejects old or incomplete candidates.

There are no committed changes between the old and new release in the RSO planner, forecast policy, data adapter, UI/API namespaces or the two existing browser specs checked. Six other producer-closure members changed: both LinemateMatrix modules, `lineSourceIftttReceiver.ts`, both PP writer routes, and `getPowerPlayBlocks.ts`. No closure modules were added or removed. Relative to #402, the RSO overlay changes only `rsoUsePolicy.ts` within the closure. Exact paths/hashes: [AFTER402-IMPACT.json](AFTER402-IMPACT.json).

## New local evidence

- **400/400 RSO tests, seven files**, passed against the replacement export: [after402-tests.json](after402-tests.json), [log](after402-tests.log). Synthetic data, inert environment and Node loopback-only guard; installed dependency manifests match the selected base. No installation or browser/server rerun.
- Both new-base and new-candidate offline closure scans passed: **195 modules, zero findings, 21 reviewed dynamic table sites**. These are tree-mode preparation receipts, not the four-file candidate's committed admission receipt.
- The actual merged SHA `f17bea20d…` was separately verified in committed mode: [after402-committed-release.json](after402-committed-release.json), receipt SHA-256 **`a9674d30f42b32d88b604a33672e311c74470075da3c9219c1bb613bb2b43b3a`**. Its commit tree, closure and current verifier/walker hashes match the isolated baseline scan.
- A proposed admission entry for **already-merged #402** was generated and tested in isolation: **101/101 tests** across `verifiedForgeReleases`, `externalInputProof` and `apiHelpers.runAdmission`. Patch apply-check passed; the export's admission files were restored afterward. [Proposal and evidence](admission-released-402/EVIDENCE.json), [patch](admission-released-402/admission.patch). Canonical allowlist/test files remain untouched.
- The old-request hold guard's syntax and rejection check passed: [after402-stale-request-guard.json](after402-stale-request-guard.json). Prior independent RSO review, type/lint and browser evidence remains recorded; it was not rerun or relabeled as a new-base browser execution.

The #402 admission proposal is **not** the receipt/entry for the uncommitted four-file RSO candidate. Both currently unlisted closures matter separately. An uncaptured-input run needs the exact admitted producer identity; captured-input proof is an independent path. No live serving failure or forecast activation is inferred from the catalog observation alone.

## Remaining engineering and deliberate release boundary

1. Parent selected the replacement scope for the updated custody request, retaining all #402 code. If other lanes join the final coordinated batch, pin the resulting full candidate and recompute the closure as needed.
2. Obtain the retained Claude local-Git and PROV-GUARD allocation, or have that owner perform the scoped operations. No handback is assumed from idle status.
3. Review the already-merged #402 receipt/proposed entry above. Commit the selected RSO candidate, generate its own real committed receipt for the expected closure, and prepare its separate admission entry. Admission files are outside the closure. The active helper inputs already pin the selected replacement; an unexpected returned SHA/tree must be reconciled, not silently substituted.
4. Verify the combined admission batch locally, freeze the exact final SHA and obtain the existing specific release approval/fan-out review. **Batch these changes; do not create a separate ship/push for each fix or entry.** No release approval is being requested on an uncommitted proposal.
5. Genuine TJ/Yahoo acceptance and native forecast qualification remain outstanding. The native-use review catalog remains empty; existing qualification protocol and scenario activation gates are unchanged.

Resource use for this reconciliation: one read-only GitHub metadata request, three local producer scans, the 400-test affected suite and 101 admission tests. **Zero hosted/local production builds, pushes, deployments, application/provider/database requests or data repairs.** Shared heavy locks were released. Unrelated dirty work and all existing refs remain untouched.

Subsequent isolated readiness work: [readiness-supplement/HANDOFF.md](readiness-supplement/HANDOFF.md) records three additional passing fixture-browser flows and a one-line test-only locator supplement. The supplement remains outside the advertised candidate; no canonical source or producer-closure change occurred.
