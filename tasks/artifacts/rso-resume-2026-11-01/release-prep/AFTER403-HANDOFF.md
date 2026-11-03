# RSO candidate after PR #403

**Current update:** exact candidate commit `c3897d3273ca46ea25a9f2737f09c835e5ec7325` is verified. Claude session `1e668672` allocated the two admission files, now installed and tested (102 tests plus scoped lint). See [ADMISSION-HANDOFF.md](ADMISSION-HANDOFF.md) for the four-file commit delivery and corrected custody attribution. The original request history below explains the base reconciliation.

The active four-file candidate now preserves merged/deployed #403. This supersedes the #402 candidate's **full tree**, not its source fixes or producer-closure findings. No Git mutation, commit, application request, build, deployment or activation occurred in this reconciliation.

| Identity | Value |
|---|---|
| Released base | `295b384da47f2a4665a76d841d3d1aa701912d8c` |
| Base tree | `f5d6366ecc9d441bd20e5f93b744187672cb6d2e` |
| Exact candidate tree | `394e3cb70d3e9995e8a1f02f75ba13973320df34` |
| Candidate commit | `c3897d3273ca46ea25a9f2737f09c835e5ec7325` — verified after owner handback |
| Candidate producer closure | `ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c` |
| Released producer closure | `f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92` |
| Canonical HEAD observed | `10b7584df07c01be9c5bf9d7f692d1e277b7263b` |

Read-only Git comparison finds 82 changed paths, all Social Share. All 195 producer-closure modules, four overlay baselines, verifier/walker, admission files and package/test configuration are byte-identical between #402 and #403. The four canonical overlay SHA-256 pins still match. Git-free blob/tree hashing reproduces both the released base trees and previous candidate tree before computing the new tree. Details: `after403-reconciliation.json`.

The Vercel metadata connector confirms one READY production deployment for the exact #403 SHA: `dpl_2cVCwMEth7cnVSdMQuoB6L1ZqXyn`. This is observation of an existing deployment, not a deployment performed by this lane. Receipt: `after403-release-observation.json`.

The 400 passing targeted tests in `after402-tests.json` were run on the prior #402 candidate. They were not rerun on the new full tree. The unchanged closure/files justify carrying that focused evidence; no new exact-tree suite result is claimed. The real #402 committed verifier receipt remains evidence for the identical released closure. Do not create a duplicate closure admission entry just because the release SHA changed.

## Original retained-custodian request (now fulfilled)

Claude orchestrator session `799e2b6c` still holds local Git custody; PROV-GUARD / historical worker `local_1bad6779` has no explicit release of the admission files. No response or transfer is inferred from idle status.

Create the exact new candidate commit and return its full SHA/tree, or explicitly allocate the limited local Git operation to RSO Codex lane `01a19764-091f-763d-a983-8c692d79200b`. Separately allocate or retain execution of only `web/lib/projections/verifiedForgeReleases.ts` and its test. Preserve the canonical checkout and unrelated dirty work. Do not commit old tree `9820a239181765a7eae2597c32c0f380c0260b5a`, substitute HEAD, or widen the four-file overlay.

The helper now rejects any unselected/superseded status and inconsistent base/tree records across the manifest, requirements and custody request. Six offline regressions pass. A read-only check against release SHA `295b384…` correctly fails because its tree lacks the four fixes. The positive path still requires the real candidate commit; no commit-backed candidate receipt has been fabricated.

After that SHA exists, run `python3 tasks/artifacts/rso-resume-2026-11-01/release-prep/prepare-committed-admission.py --commit <full-sha> --prepare`, then test the isolated proposed admission files. The helper does not write Git or canonical source. Installation/commit remains with the allocated owner.

Keep the fixes and necessary admission entries in one coordinated release batch. No push, hosted build, deployment, activation or provider/database execution is authorized. Qualification supplements remain separate artifacts, outside this four-file candidate. Current production model identity remains unobserved; the configuration-read blocker and exact owner handoff are in `qualification-capture/OWNER-DECISION.md`.
