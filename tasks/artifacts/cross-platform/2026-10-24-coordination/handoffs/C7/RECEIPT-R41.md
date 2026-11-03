# C7 review R41: `978134e22` (F2), `00d375839` (F6), `5a19f1def` (F1)

**Verdict: accept with limits.**
- F2 and F6 are correct.
- F1's closure hash and receipts reproduce from the commit, and its admission rules fail closed for resumes, relabelled SHAs, malformed stamps and contradicting capture.
- **The open limit is the known V2:** in unbuilt code (dev, tests, local scripts) the stamp comes from the runtime env, so an env label **plus** a full `GIT_SHA` still yields admission (my control shows it). PROV-GUARD's in-flight hardening (a build-only stamp, refusing `local:*`) must close this before release.
- Other notes: L1–L4.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commits** (`git archive` at `/private/tmp/c7-r41`; parents archived separately), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and `FORGE_PRODUCER_CLOSURE_SHA256` unset.
- I also read the audit's F1, F2 and F6 sections.
- Evidence is in `r41-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit `5a19f1def`** (all three commits): `candidatePlanMetrics`, `planning`, `dailyAcceptance.e2e`, the RSO component, `externalInputProof`, `forgeProducerIdentity`, `verifiedForgeReleases`, `apiHelpers.runAdmission`, `releasedRunFence`, `forge/players`, `explicitRunAdmission` | **587/587** |
| **F2 parent** (`82490cd45`, with the F2 tests) | **197/202.** The 5 new cases fail, including "assignment denied: capacity-chosen legal lineup, approved SOG totals and a comparable plan", "…keeps drop-loss accounting", and the two "totals stay unknown, never zero" controls. |
| **F6 parent** (`978134e22`, with the F6 tests) | **224/225.** "backs a lease-denied tab off to a bounded retry instead of spinning…" fails. The e2e packet passes on the parent too (8/8): it's an acceptance packet for existing behaviour, not a regression test. |
| **F1 parent** (`00d375839`, with the F1 tests and receipts) | **78/97.** Three suites can't load (missing module or exports), plus 19 failing cases. Most of the `forge/players` failures come from the moved `requireLatestExternalInputProvenRunId` mock target. |
| **My F1 controls** (`r41Identity.test.ts`) | **15/15** (below) |
| **Closure reproduction** | The committed `scripts/forge-producer-closure.ts --json` on my archive of `5a19f1def` gives **`0e987626…8e4f`**, 193 modules, 0 findings. That equals the allowlisted closure and its receipt. The same walker on my archive of `538100d41` gives **`4bf0fce7…cbbb`**, 192 modules, 0 findings, matching the regenerated receipt's `producerIdentity`. |

## F2 (`978134e22`): totals and comparison without assignment permission

| Question | Evidence | Result |
| --- | --- | --- |
| **Can SOG choose a slot without assignment permission?** | No. Slot values (`playValue`, `planning.ts:280, 289`) require `forecastAllows(..., "assignment")`. Without it the value is null, the play joins the unknown component, and `weightedAssignment` fills that component by schedule capacity with a deterministic player-id, then game-id, order (`:390-391`). F2 changes **pricing only** (`pricedOnly`, `totalsUnresolved`), not `assign`. | Holds |
| **Can SOG break a tie without permission?** | No. Conditional tie-breaks require `forecastAllows(..., "conditionalTieBreak")` on every target (`:435`); SOG keeps it denied. | Holds |
| **Does missing data stay null?** | A capacity-chosen play is priced only if its forecast is unconditional, eligibility is verified, there's no `conflicting_forecast`, and **every** scoring target is allowed for **both** totals and comparison and is finite. Otherwise it stays in `totalsUnresolved`, so `projectedValue` is null and category `own` is null. The committed controls cover "totals denied" and "comparison denied", both of which stay unknown and never become zero. | Holds |
| **Is the dropped player's loss in the net?** | A candidate's gain is the candidate plan's `projectedValue` minus the baseline's, on full-roster plans, so the dropped player's games leave the total. The "assignment denied" test and the e2e packet assert gains equal the plan difference **including the drop loss**. | Holds |
| **Labelling** | `selectionMethod: "schedule_capacity"` and the limitation "Lineup chosen by schedule capacity … no projection chose slots or broke ties". `candidatePlanMetrics` won't use a capacity-chosen outcome baseline as a separate outcome baseline. | Holds |

**L1 (info):** when eligible players outnumber slots, the capacity lineup is **id-ordered**, so baseline and candidate totals price whichever players that order starts. A candidate's gain can partly reflect which competitor the id order benches, not just a start/sit judgement. It's labelled as a capacity lineup, which is correct under denied assignment, but the UI should present it as "on the schedule-capacity lineup", not as a best lineup.

## F6 (`00d375839`): upkeep-lease retry

| Question | Evidence | Result |
| --- | --- | --- |
| **Is the retry bounded?** | On a failed claim, `schedule.nextAutoAt = max(nextAutoAt, now + 60 s)`, then `scheduleNext()`, so the next check is ≥60 s away. That's one localStorage claim per minute per non-holder tab, down from ~250 per second. A holder that hides, goes offline or unmounts releases the lease, and the non-holder takes over at its next check (≤60 s). | Holds |
| **Does a non-holder ever read the provider?** | **Not for timed or event upkeep.** The lease check is on the `!initial` path, which the committed test covers. **But the effect's first call, `refresh(true)`, skips the lease** (`!initial && …`). So every newly mounted tab, and every re-run of the upkeep effect (it depends on `accountKey`, `teamId`, `leagueId`, `canSync`, `canAutoUpkeep`, `viewingSaved`, `networkSuspended`, `settledProviderRefresh`) whose `nextAutoAt` has passed, reads the provider even while another tab holds the lease. Explicit Refresh is ungated by design. | **L2 (low):** the commit message's "never reads the provider while it isn't the holder" is overstated. A first load per tab is reasonable (it has no data), but the D2 read budget (~280 per hour) should count one read per tab open or context change. |

## F1 (`5a19f1def`): producer-closure identity admission

| Question | Evidence | Result |
| --- | --- | --- |
| **Can a resume yield admission?** | No. A resume appends its closure (`producerIdentityStamp(prior, true)`), so the stamp has two entries, and `resume.invocations` is ≥2. Admission requires `invocations === "1"` **and** exactly one stamp entry. Controls: `[V, V]`, `[null, V]` and `invocations "2"` with one stamp all deny. | Holds |
| **Can a relabelled SHA yield admission?** | For stamped runs the SHA is only required to be a full released SHA. It's never trusted: the **closure** is (control: any full SHA plus the verified stamp is admitted with `releaseSha` = the recorded SHA, which is the intended "unchanged closure qualifies" rule). A malformed or unverified stamp on the verified exact SHA `538100d41` **denies**, with no fallback to the SHA list (control). Unstamped runs still need the exact `538100d41`. `local:*` and short SHAs deny. | Holds |
| **Can an env label yield admission?** | **In a production build, no.** `next.config.js` (production-build phase only) inlines `FORGE_PRODUCER_CLOSURE_SHA256` as a literal computed by the closure scanner from the source being built, so a runtime env var can't relabel a deployed build. **In unbuilt code, yes.** `currentProducerClosureSha256()` reads the runtime env (dev server, `ts-node` local runner, tests). With `FORGE_PRODUCER_CLOSURE_SHA256 = <verified hash>` **and** `GIT_SHA`/`VERCEL_GIT_COMMIT_SHA` set to any full SHA, a local single-invocation run is admitted (my control "OPEN (V2)" passes). This is R40's V2, which PROV-GUARD is now hardening (build-only stamp, `local:*` refusal). | **Open (V2), required before release** |
| **Is the admission code really outside the closure?** | Yes. `ADMISSION_MODULES` (`externalInputProof.ts`, `verifiedForgeReleases.ts`) are **not** among the 193 modules at the commit; the scanner flags `admission_module_in_closure` if they ever enter. `requireLatestExternalInputProvenRunId` moved out of `apiHelpers.ts`, which **is** in the closure via `run-projection-accuracy`. So listing a verified closure never changes it. | Holds |
| **Does the allowlisted hash reproduce from the commit?** | Yes. `0e987626…8e4f` (193 modules) reproduces from my archive of `5a19f1def`, and `4bf0fce7…cbbb` (192) from `538100d41` with the new walker. Receipt hashes: `538100d41…json` `0197d657…` and `closure-0e987626…json` `d61a4665…` both equal the allowlist. The bd337d97a negative receipt is now committed (`25c6eb54…`), **closing R40 V1**. The receipts' `verifierSha256` equals the committed verifier (`14d7e4f9…`), and `closureWalkerSha256` equals the committed `forge-producer-closure.ts` (`e33ccacb…`). | Holds |

**Other notes (F1):**
- **L3 (low, availability):** the build-time hash runs `ts-node` with `typescript`, both **devDependencies**. A build that omits dev dependencies, or any scanner error, writes `""`. Every run from that build then stamps an unknown closure and is withheld. That fails closed, and the build log only warns. Consider failing the build, or at least alerting on it.
- **L4 (info):** `--print` (used by the build) emits the hash **even when the scan has findings**. That's harmless for admission, because only allowlisted (verified, zero-finding) hashes admit, but a findings-bearing build stamps a hash that can never be verified. A build warning would help.
- **Still open from earlier:**
  - V3: `basis`, `releaseSha` and `closureSha256` aren't surfaced to responses (PROV-GUARD).
  - R39 G1: teams, goalies and game-prediction readers remain unguarded (audit F4 scope).
  - The closure entry's note says it was verified on a worktree off `82490cd45`. It reproduces exactly at `5a19f1def`, but **any closure module that changes before release** needs a new receipt, as the note itself says.
