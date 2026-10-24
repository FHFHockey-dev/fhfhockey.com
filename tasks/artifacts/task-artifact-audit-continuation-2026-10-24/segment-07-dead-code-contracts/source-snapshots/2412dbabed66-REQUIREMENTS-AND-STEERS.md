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
