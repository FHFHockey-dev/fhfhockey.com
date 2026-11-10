# BLSH fresh native capture proposal — 2026-11-09

**Proposed execution only; actual adapter wired and mock-tested, not authorized to run.** Prepare one local capture of two current-season NST skater pages with original parser bytes and clocks. Claude's merged shared controls are integrated through the [corrected BLSH candidate](REVIEW-AND-RUNTIME.md); 63 runner and 29 actual-adapter tests pass. Exact current hashes are in `ADAPTER-CHECKS.json`. Local loader/TLS probes pass; fresh-context review and identification of the actual configured execution process still precede TJ's separate approval. No live capture, provider/DB request, ledger operation, production configuration change or deployment occurred.

## Custody and purpose

Claude Chef `local_c4e6c533` acknowledged the handoff in `CLAUDE-CHEF-ACK-CODEX-BLSH-CONTINUATION-20261108-03`. TJ transferred `web/lib/nst/**` to Claude on November 7; the NST executor identified by Chef is `local_3bb2755d`. Codex retains BLSH/RSO. The stale November 1 Codex lease needs a release receipt from its original owner/root coordinator; BLSH recognizes the transfer and claims no shared NST files.

Chef confirmed **non-retention of the requested historical NST raw bodies and original clocks**. Do not search again for those bytes or manufacture them from database values. This proposal captures a new observation with a new clock. It does not refresh, re-date or repair the November 1 request.

Success means retained real markup/transport evidence for parser and redaction review. Two pages cannot establish every player's latest-five window, adopt a source/model policy, produce a recommendation or complete VuDu. Baseline weight 1.0 remains settled. The 2025–26 reserve is excluded.

## Exact target and stop conditions

- Local operator: the confirmed Claude NST owner, using the canonical authenticated client through a reviewed BLSH capture runner. No Vercel route, cron, ingestion, database repair or application publishing endpoint.
- Season `20262027`, regular season, candidate game date **2026-11-07**, all teams, skaters, all strength, count values. This date was selected to avoid treating the possibly unfinished November 8 slate as completed. Calendar age alone is not proof of completion.
- One official schedule GET: `https://api-web.nhle.com/v1/schedule/2026-11-07`. Retain original response bytes, hash and retrieval clock. Require exactly one unambiguous matching `gameWeek` day, a nonempty set of regular-season games in season `20262027`, unique coherent game/team identities and `OFF`/`FINAL` for every target-date game. Unknown, postponed, contradictory, absent or incomplete status stops the pilot before NST admission. Do not follow pagination or fetch boxscores/other dates. The schedule is a date-finality witness, not a per-player TOI/appearance frame.
- Exactly these NST URLs, in order, using header authentication and no query-key fallback:

```text
https://data.naturalstattrick.com/playerteams.php?fromseason=20262027&thruseason=20262027&stype=2&sit=all&score=all&stdoi=std&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2026-11-07&td=2026-11-07&lines=single&draftteam=ALL
https://data.naturalstattrick.com/playerteams.php?fromseason=20262027&thruseason=20262027&stype=2&sit=all&score=all&stdoi=oi&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2026-11-07&td=2026-11-07&lines=single&draftteam=ALL
```

- Shared ledger target: **Production Supabase project `fyhftlxokyjtpndbkfse`**, `/rest/v1/rpc/…`, as identified in the owner’s NST install receipt. That is a recorded target, not a fresh production readback. The runner must reject a different project before any network call. Existing credential names are `NST_KEY` and the established Supabase service-role configuration; no value enters this packet or logs.
- Recreate the strict local plan immediately before execution; it expires after 15 minutes. Revalidate its current-season/seven-day date bounds. If this date no longer qualifies, submit a revised date/URL proposal; do not silently substitute a newer date.
- Stop at the first failed/denied/expired/uncertain admission, HTTP/redirect/TLS error, oversized response, unexpected source shape or retention failure. No automatic retry, alternate host/key, cache substitute, second process or continuation after a partial result.

## Complete request budget

These are maximum application-level HTTP operations for one execution, including failed attempts. They do not count DNS/TLS packets. The merged client now supplies an opt-in `maxAdmissionCalls` ceiling; the actual adapter opts into one call per page and routes each actual attempt through the runner. Default polling for other callers is unchanged. The tests below establish the local contract, not execution permission.

| Operation | Maximum | Effect |
| --- | ---: | --- |
| Official NHL schedule GET | 1 | Public source read; private local retention only |
| NST GETs | 2 | One individual and one on-ice page; sequential; zero retries |
| Shared admission RPC POSTs | 2 | **One call per page attempt**; a denied permit stops instead of polling |
| Existing lifecycle begin | 1 | Only when the runner's existing lifecycle mode is enabled |
| Existing lifecycle finish | 1 | Only after all provider/body/retention work has settled |
| Existing lifecycle hold | 1 | At most one existing error-path hold, including after uncertain finish |
| **Total ceiling** | **8** | **3 provider GETs plus at most 5 Supabase RPC POSTs** |

If existing lifecycle mode is disabled, there are no begin/finish/hold calls: ceiling **5** operations, including at most 2 legacy admission RPCs. The owner must record the actual non-secret mode in the final approval packet. Preserve that mode; this proposal does not enable/disable lifecycle or change DB controls. If mode, target, schema contract or source pins differ from the reviewed packet, stop. No additional status polling, readback SELECTs, auth refresh, HTTP redirects or external preflight calls are included; any required addition changes the approval request.

The normal successful enabled-lifecycle path uses at most 7 operations; 8 reserves the existing hold after an uncertain finish. The hard counter must include that cleanup path and never retry an uncertain mutation. Failed or expired permits remain consumed. A failed begin/finish/hold may leave unresolved occupancy; inspect retained results and obtain separately bounded reconciliation authority rather than retrying or clearing state.

## Ledger and persistence effects

- Both modes retain `withNstRequestBudget` and `admitSharedNstAttempt`. Local budget reservations/dispatch/completion updates occur in the existing same-user temporary ledger; do not clear it or substitute a private budget. Up to two local attempt reservations may be charged even when shared admission prevents provider dispatch.
- Admission locks the production `nst_request_admission_state` singleton. Each allowed permit updates its attempt timestamp array and spacing, pruning expired entries under the existing algorithm; at most two new attempt timestamps. No permit refund. A denied budget response does not append an attempt.
- With lifecycle disabled, each `nst_admit_attempt_v1` call also updates `nst_job_control.last_untracked_at`, even if the budget then denies it. This can invalidate an earlier qualification marker. That is a production control write, not a read-only preflight.
- With lifecycle enabled, use existing `runNstJob` and `nst_admit_job_attempt_v1` with one token. Begin can insert one `nst_jobs` row; finish or hold updates it. A held/expired job can block subsequent NST work until separately reconciled. No control flag, claim/cohort/evidence table, stored statistics, score, forecast or release record is changed by this capture.
- Capture artifacts use a new private local directory (0700), exclusive 0600 files and atomic completion publication. Retain each successful page before starting the next. Retain the original lifecycle job token privately before begin so an uncertain outcome has a concrete reconciliation target; finish/hold must use that token. Preserve partial artifacts; never imply completion after a write or settlement failure.

## Rate, time and byte protections

- Concurrency **one** across all network work. NST `maxAttempts: 2`, `plannedRequestCount: 2`, retries **0**, no query-key fallback or redirects. Keep the existing auth/redaction/client route.
- Pace NST starts at least **22 seconds** apart and honor both local and global controls. The repository policy is 40/min, 80/5 min, 100/15 min and 180/hour across all participating jobs; the actual accepted limiter is stricter at **39/min** with 22-second standard spacing and the one-second permit-expiry allowance. Preserve those stricter settings. No burst is requested despite the small plan. Other jobs retain their normal schedules; insufficient global headroom stops this pilot.
- Provider timeout **15 seconds** including body consumption; shared/lifecycle RPC timeout at most **5 seconds**; work deadline **120 seconds** from run start. The existing error-path hold may consume up to **5 additional seconds**. No background fan-out or continuing process after timeout.
- Use the merged optional client streaming cap: **2 MiB accepted decoded bytes per NST page**, maximum **4 MiB** for both. Official schedule accepted decoded body: **1 MiB**. The adapter also bounds its lifecycle RPC bodies to 64 KiB; shared admission JSON remains on the canonical client's existing `response.json()` path, without a newly imposed body-byte cap. Bound parser input to 5,000 rows per page and the complete capture directory to 8 MiB including source snapshots/metadata. Overflow stops without another request.
- These are retained/accepted decoded-body caps, **not exact wire-byte limits**: buffering, compression and an oversized delivered chunk can exceed them before cancellation. Exact incoming bytes and monetary cost remain unknown. A requirement for an exact wire-byte ceiling needs a different reviewed transport and a revised proposal.

## Local implementation and review before execution approval

**Claude NST owner** retains `web/lib/nst/**`. Its bounded-body patch, optional single-admission limit and operation hook are merged in PR #419, together with the newer production-origin guard. BLSH did not edit those files. Current source pins include `admissionOrigin.ts` plus refreshed `sharedAdmission.ts` and lifecycle hashes; the old isolated patch and pre-guard mailbox pins remain historical. Existing accounting, rate controls, job tokens and redactor remain in the canonical path.

**Codex BLSH lane** has wired and tested the actual adapter, preserving the corrected packet composer. [REVIEW-AND-RUNTIME.md](REVIEW-AND-RUNTIME.md) records the pre-dispatch timing correction, 63 runner and 29 adapter tests, and actual local loader/TLS observations. The adapter tests run canonical NST/admission/lifecycle modules with only HTTP and the local ledger mocked. It uses each pre-dispatch hook, exact client-returned text and the original completion witness. Private job references survive uncertain begin; request headers and full RPC bodies do not enter receipts. The older `executeNativeProcessCapture` still throws, and no live CLI is enabled. The tested shell has no configured capture keys/project; future provider TLS and source acceptance remain unverified. A supplied boolean is insufficient provenance.

The final local candidate must pass mocked end-to-end checks for: exact URL order and no follow-up calls; refusal before network on stale/wrong scope/project; complete-date guard; every RPC/GET count in the table including denied permits and uncertain finish; concurrency/pacing/deadlines; body overflow and first-page preservation; original clocks; auth/redaction; exclusive output and interrupted completion. All transports are mocked/blocked in those tests. Recheck the exact candidate SHA/source hashes after integration.

Only after exact candidate review and runtime provenance should TJ see the final execution request: **one run, exact date/URLs/project, actual lifecycle mode, exact runner/adapter/client hashes, at most 8 operations and the listed ledger writes**, with no deployment or broader data refresh. Local implementation and mocked success do not authorize execution or complete the whole first pass.

## Verification after an authorized run

1. Use the retained local operation receipts to account for each GET/RPC, permit and lifecycle result; do not make extra remote reads or poll to fill gaps. Mark uncertain outcomes explicitly.
2. Verify original source/code hashes, private modes, byte/row limits, UTC clocks, actual response status/origin/redirect/TLS evidence and the atomic packet manifest. Review credential-echo redaction before sharing artifacts.
3. Run the existing pinned intake/lineage checks and corrected composer only when matching current official per-player frames and request rows are supplied. Native markup compatibility alone cannot invent those inputs. Require every required field to match; retain missing/ambiguous/partial holds.
4. Default-closed gate must still admit zero and compute no scores until a separate independent exact-byte source/method review. Do not substitute the old snapshot, model price or observed table agreement for provenance.

## Independent application/goalie continuation

The trade selector implementation is unchanged; its suite now passes 22 tests with a new actual-view regression through Claude's merged forecast-optional goalie interpreter. Unknown participation remains unknown and expected values stay withheld. The owner separately confirmed non-retention of the requested official goalie packet and admitted forecast envelope. A real trace still requires complete 2026–27 team-game membership and original official boxscore/starter/outcome receipts under separately bounded collection approval. Do not fabricate a forecast, use an appearance-only list as complete membership, or treat the descriptive preceding-history block as an accepted personal goalie method. No shared goalie/interpretation source was edited here.
