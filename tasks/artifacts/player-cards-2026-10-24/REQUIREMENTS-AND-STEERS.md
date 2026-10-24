# Player cards requirements and steer ledger

Owner: bounded player-card worker; Scout owns integration, product decisions and independent acceptance. Source PRD/tasklist identities and hashes: INPUTS.json. Local execution only; no workers.

## Confirmed
- Anonymous player search, curated card and PNG download are free.
- Optional metrics/cards; premium expanded metrics and two-player comparison. Exact allocation and comparison export undecided; premium remains off.
- Every rankable metric: actual value, raw ordinal rank / metric-specific N, same-pool percentile.
- Pool: all NHL players with a valid same-definition value, including valid zeros. No GP/TOI, position, active-roster or recency filter.
- Default period mode is each player's own L5/L10/L20 appearances at a common cutoff; shared inclusive calendar dates are an option.
- Synthetic previews/exports prominently labeled; no live rankings or coverage claims.

## Proposals (not product approvals)
- L10, All Strengths, regular season, season-contained windows; honestly short season samples versus strict complete-N behavior.
- Competition ties 1,2,2,4 and empirical midrank percentiles; compare unrounded canonical values.
- Curated eight-metric default and optional extra card, 1080 square, charcoal/cyan.
- Explicit local fixture configuration may demonstrate proposals. No observed behavior enabled by a proposal.

## Boundaries and integration facts
- Canonical octoberBranch HEAD 2a5092d37cb863ec92a2a4e609999cf226bfa4a5; unrelated dirty work preserved.
- Existing PlayerSearchBar imports live Supabase directly. Do not mount it for fixture preview.
- Shared _app/auth may write profiles. Standalone fixture artifact avoids app hydration and all service imports.
- Existing html-to-image, React, Sass, esbuild, Vitest, TypeScript, Playwright are installed. Schedule-share export is schedule-specific and SS1-owned: consume design direction only; no shared edits/imports.
- Existing in-season access grants rso_* capabilities only. Card allocation and protected boundary integration need explicit reviewed contract; do not infer card access from RSO flags.
- No repository .agents/skills. User-level reverse-engineer-anything expressly skips ordinary source analysis; relevant Library and interface-polish guidance used.

## Source gates
- WiGO REPORT and production-diagnostic/REPORT read. Ten offline cases plus 68 captured rows for one player do not establish league coverage.
- Current reader/materialized windows cannot establish requested card periods. WiGO worker owns repairs; do not duplicate or call ingestion.
- Completion proof, full all-position population, supported strengths, source/model universe, matching snapshot/joins, redistribution and asset rights remain unverified for live cards.
- Existing production diagnostic is evidence only; no additional production/service reads authorized here.

## Current slice
- Inputs installed via complete Library text reconstruction with exact bytes and identity. Supported signed transfer failed in sandbox and escalated environment; no input content guessed.
- Requested exact new source leases and proposed fixture-only port3125 from coordinator. No source files or servers created until collision/ownership/resource confirmation.
- Candidate route absent; leave uncreated until exact route lease and safe app integration are reviewed.
- Parent message delivery attempted to supplied source_thread_id; tool returned thread not found. Coordinator message delivery succeeded. Platform final handoff remains available.

## Slice01 frozen
- Exact nine-path ownership granted by coordinator CODEX-023 at16:39:39UTC. Static loopback3125 reservation granted; PID54140 serves frozen HTML only. Local byte-equality GET200;10/10 unit and10/10 offline browser checks, scoped types/lint pass. See slice-01/HANDOFF.md and EVIDENCE.json.
- Live/premium/route remain inactive. Period controls fixed and explicitly proposed; no unimplemented working control.
- Supported Library batch output fails before preparation (DNS sandbox/TLS escalated). No outputIDs or uncertain mutation. HTML/actual exportedPNG are local deliverables; browser captures internal only.

## Slice02 boundary
- Proposed four new pure domain files only: windows.ts, aggregation.ts, adapter.ts, domain.test.ts in owned lib namespace. Exact paths sent to coordinator before source creation; no S01 UI edits.
- Appearance frames must explicitly assert complete official history and supply per-game completed evidence/time; unknown participation/completion invalidates selection. Future games excluded before N. Duplicate game identities rejected. No inferred final-state signal.
- Current-season-only and short-sample policies remain caller-selected proposals. Known short history differs from missing history; missing metric rows never reduce actual GP. Zero strength exposure does not remove an appearance.
- Aggregation requires matching strength/source/version/game identities and complete metric inputs. Rates use pooled seconds; ratios pooled components. A valid zero stays valid, zero denominator is known undefined, missing components stay missing.
- Adapter accepts caller-supplied local snapshots only. No fetch, environment credentials or WiGO imports. Full all-NHL population completeness and same-definition pool identity required for league rank; incomplete/unknown populations may keep an individual value but cannot emit an NHL rank.

## Slice02 implemented
- Coordinator granted exact four absent paths CODEX-PLAYER-CARDS-S02-20261024 at16:54:13UTC. Parent steer explicitly says no need to wait for S01 visual approval; preserve preview/server and do not retry/work around Library TLS.
- Implemented pure supplied-record appearance windows, pooled components, metric-specific coverage, local adapter with all-population rank gating.19 focused domain tests plus scoped TS/lint pass.
- Completion and full-history evidence are mandatory supplied contracts, never inferred from game dates or a successful data read. Current-season-only and known-short/full-N alternatives are explicit proposals. Data snapshots later than cutoff are marked retrospective, never as-known historical evidence.
- Source/model/metric definitions and full-population proof remain assertions that a future reviewed input adapter must establish. This implementation checks identity/alignment/completeness consistency; a nonempty evidence reference is not independent verification of its contents. All live/premium activation stays false.
- Approved one-player capture reconciles raw L5 math and actual missing Oct5 join in currentL10. It lacks complete-history/final-game/all-NHL proof; S02 does not fill these gaps. No new external/service request.

## Parent S01 acceptance / S03 steer
- Parent accepts frozen S01 locally with independent-review limits:43pins matched,15unique offline cases and scopedTS/lint passed, PNG values/ranks matchmanifest. Phone readability remains TJ design feedback. This is synthetic-preview acceptance only, not live data/full-product acceptance. S02 independent Sol review in progress.
- Parent authorizes next fixture-only free interaction slice; coordinator grants six absent source paths CODEX-PLAYER-CARDS-S03-20261024 at17:08:54UTC. Preserve frozen S01/S02 source/receipts. New files consume frozen formatter/export and purecontracts read-only.
-18-player fabricated cohort is separate from the one-player approved diagnostic. No real league completeness claimed. Dynamic ownL5/L10/L20/calendar, strength and unavailable states compute from fabricated records. All source proofs are explicitly synthetic; premium/live activation stays off.

## Independent S02 correction steer / R1
- Parent review found P2 game-level consistency defects before pooling. Original23/29pass with6failing probes remains unchanged in slice-02-review. Parent requires bounded R1 before dependent S03 acceptance; no calculation-acceptance claim before re-review.
- Coordinator transferred aggregation.ts/domain.test.ts and absent aggregation.r1.test.ts, CODEX-PLAYER-CARDS-S02-R1-20261024 at17:17:47UTC. Exact before bytes/hashes preserved; original63 S01/S02/reviewer artifacts unchanged.
- Author R1 passes26tests (19original+7regression), all29unchanged independent probes including6originalfailures,7nearby flow tests, scopedTS/lint and priorcapture controls. Positive/zero-exposure and impossible ratios are missing/incomplete per affected metric; genuinezero/zero remainsundefined; no samplethreshold. Independent acceptance pending.
- S03 initial8offlinebrowser checks/3PNGs are historical candidate proof. No existing3125handoff occurred. Current-source7flow tests/types/lint pass againstR1; rebuild and affected browserQA remain before candidate handoff. S01server and accepted artifact preserved.

## S03 resumed checkpoint
- Scout accepts boundedR1 based on independent re-review:58pins,29/29originalprobes including6failures,26/26units andscopedTS/lint; localcalculation acceptanceonly. Parent authorizes existingS03 rebuild/browserQA/conditionalserverhandoff.
- S03 final6files frozen,7componenttests/scopedTS/lint pass; final9offlinebrowsergroups/3PNG+manifestexports pass withzeroexternal attempts/pageerrors. FinalHTML317312bytes/SHA c50ecfbe2fc56955c085c5ff1adfadef9d5a393c39f2a2ad1fb4b6aebe854357 servedbyte-equal fromowned127.0.0.1:3125, PID67888/session57709.
- Guardedownedprocesshandoffs only; originalsource/artifact/reviewreceipts preserved. Currentflowcomputedentirelyfromfabricated18-player/game data, supports ownN/calendar and honest source/GP/TOI gaps; no canonicalroute/live/premium activation. IndependentS03acceptance and originalsource/product/rights gates remain.

## S03 independent semantic review / R1
- Parentrequires boundedPC-S03-02(P2 standalonePNG mustretainmissing-source explanations; completeundefined metricsnotpartialsource) andPC-S03-01(P3 nullGP accessiblelabel). TJdesignreferences/direction unresolved; no designoverhaul.
- Exact3-file correction custody CODEX-PLAYER-CARDS-S03-R1-20261024 at17:55:39UTC. Original3baselinebytes preserved/verified beforeedit. Correctedper-metricSVGcontext, combinedshort/sourcewarning, initialavailabilitybanner andGPunverifiedaria; acceptedmath/fixtures/SCSS unchanged.
-10owner +5unchangedreviewprobes pass; scopedTS/lint;6usableunchangedbrowsergroups + focusedpre-exportzero-bannercontrol pass,2actualPNGexports. Originalmanifestsidentical,92originalartifactfilespreserved,65reviewpins differonly3authorizedsources. Independentacceptancepending.
- Parentavailabilityexception:3125absent, so restoredonlyoldfrozenS03HTML/server afterhash/freeportcheck, PID76261/session88560. OneGET200exactold317312bytes/c50ecf...hash. R1candidate318626bytes SHA6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5 remainsfile-only, notserved. Any correctedcontenthandoff requiresseparatecoordination.

## Accepted R1 preview handoff
- ScoutacceptsboundedS03R1/closesPC-S03-02/01 afterindependent8focusedtests/4offlinebrowsergroups/161pins. Parentexplicitlyauthorizes onlyexactreviewedR1 onownedloopback3125, no newvisual/live/app/publication/Libraryiteration.
- Freshportinitiallyabsent; exactR1 started81671, verifiedbyte/hash/labels. Parentrequestedpersistentworkflow afterpreviousdisappearances; freshcheckconfirmed81671stillours, so guardedhandoffstoppedonly81671 andlaunched81978 viaPOSIXbackgroundsession/stdinDEVNULL/filelogs. No auto-restart/startup/securityconfig or unrelatedprocesschange.
- Separateafter-launcher-exitcheckconfirmedPPID1/PGID81978/noTTY andsole127.0.0.1:3125listener; GET200318626bytes exactaccepted6c29f6...hash/syntheticlabels. All161pinsunchanged. Post-turnsurvivalunobserved; coordinatoraskedtoverifyonceafterfinal. Host/environmentshutdownstopsprocess. Finalhandofffolder slice-03-r1-preview-handoff.

## Visual checkpoint input gate / direct TJ steer
- TJapprovedoneboundedlandscapeeditorialprototype withcheckpointedfeedback, then directly supplied thewrittenbrief inthischat. Parentrequires5referenceimagepixelsinspectedlocallyfirst; no designimplementationfromunseenimages.
-5LibraryIDsresolveversion0 butsupportedinputtransfersallfaildownload; singleallowedexecutor-local/tmpretryfailsfirstimageandstops.0readablefiles/0pixelinspections; oldblockedoutputuploadneverretried/securitynotbypassed.
- TJdirectclarification chooses **Wait for accessible references**, ratherthanwrittenbrief-onlyoverride. Visualimplementationpaused; independent BRIEF.md andprecise INPUT-LIMITATION/HANDOFF savedinvisual-checkpoint-01. Acceptedsource andserver81978unchanged. Resumewhenall5originalreferencepixelslocallyreadable; exactsourcecustodywillfollowinspection.

- TJ direct attachments clear five-reference pixel gate. All five viewed locally; visual-checkpoint-01/LOCAL-REFERENCES.json pins provenance. One landscape synthetic card only; preserve accepted math/export/semantics. First checkpoint before full-tool styling. No new Library upload authority.

- Visual01firstcheckpointdelivered:one1200x900syntheticlandscapecardonly;9curatedmetrics,actualratiosstrip,rawranks/percentiles;frozenmathunchanged.4offlinebrowsergroups/5tests/scopedTS/lintpass. TJdirectfeedbacknextbeforepropagation. Finephonefooterneedszoom;nofinaldesignacceptanceclaim. runtimePID98041servesnewcheckpointandexactacceptedfunctionalartifactontwo3125paths.
