# RSO browser spec: release-base adaptation, artifact only

Prepared against Chef-verified remote master **`03c53add225fea452c2e2e92515aab08e56c3c3d`**, using local read-only Git object access. No remote query, fetch, index/ref mutation, composition or canonical spec edit was performed by L2. Canonical HEAD at preparation was `1fe279d3a2c1340ea85334cbcabb8626f6e8b910`.

## Exact result

- Canonical before SHA256: `a16bddc3c2bba0c9e5ec7d8c165c531bb3e78501b1e851e0ca2f8f703490b135`.
- Release-base spec SHA256: `fb096e6a413c6e4e79111cfffd9fb69974672133e2d46ae41d584592e0665be9`; Git blob `3c8f3f5e345c0ccf67850a4d50bb90aef5ac6073`.
- Candidate after SHA256: **`f036a92bcf22de1916477433c819612951ad8201b3e803e0fea693cf3d838fe9`**.
- Candidate full source: `roster-schedule-optimizer.spec.ts` in this artifact directory.
- Release-base patch: `release-base-audit.patch` — exactly **one assertion line replaced**.
- Accepted audit extraction evidence: `accepted-canonical-audit.patch` (canonical HEAD → current pinned spec).
- `RECEIPT.json` records all hashes, base UI/fixture/config pins and mechanical scope assertions.

## Acceptance scope and separation

The accepted RSO audit delta is exactly the healthy-IR assertion: **additions are blocked until reserve occupancy is resolved; existing active lineup can still score**. The current uncommitted spec is byte-identical to canonical HEAD plus this single assertion replacement. No other audit test assertion was discarded.

The candidate is byte-identical to the release-base spec plus that same replacement. It retains the entire healthy-IR fixture and its other assertions: Yahoo injury/IR state, corrective bench/active action and **+2 active games**. Existing weekly-lock, points-goalie and projected-candidate tests remain intact.

The verified base UI has `aria-label="Itinerary"`; base spec selectors already agree. Therefore adaptation starts with base bytes, rather than importing the canonical `Week` selectors and changing them back piecemeal. This also preserves fixture period IDs named `Week`; no global text substitution was used.

Excluded canonical-only inherited changes: Week navigation/region selectors; scoped Confirm-planning-inputs selectors; the 15→30-minute provider-refresh test change; and the hardcoded band-label color assertion/comment. Those are not part of the accepted RSO audit delta and do not justify importing unreleased toenail/UI/cadence work. Base UI, fixture helpers and all other test content remain unchanged. No source fixture or protected Profiles/history was opened.

## Actual checks and execution handoff

- Inspected current diff, release-base→canonical diff and base UI label; mechanically proved both one-line relationships and unchanged canonical bytes.
- TypeScript syntax parse of isolated candidate: **0 parse diagnostics**. This is not a typecheck, test discovery or browser result.
- No browser, server, heavy check or Playwright discovery run. L6 owns the current browser/heavy slot; this task did not acquire it.

After custodian composition into the isolated candidate export, Chef can reserve an unused local port (example 3112), acquire the shared slot and run from that export's `web/`:

```sh
PLAYWRIGHT_ISOLATED_NEXT=1 PLAYWRIGHT_PORT=3112 npx playwright test e2e/roster-schedule-optimizer.spec.ts --grep 'alerts on a healthy|weekly lock keeps|points goalie coverage|projected candidate fit' --workers=1 --retries=0
```

Use port 3112 only if independently confirmed free/reserved for this candidate; do not reuse the canonical dev server or L6's server. The four selected cases exercise the changed IR assertion plus inherited Itinerary-sensitive audit scenarios. Their existing mocked fixtures are retained. Runtime execution and artifact acceptance remain pending Chef; no failure is predicted or hidden by this static preparation.

**Do not apply this artifact to the current canonical spec:** its UI still uses Week. Install only in the custodian's release-base composition, replacing the prior canonical spec inclusion pin with this candidate pin. This is safely separable; no blocker was found in extraction. Git composition remains with the custodian.

## Yahoo disposition update

Per `CUSTODIAN-RESPONSE.md`, the Yahoo test-only slice is **deferred from this release composition** until the independent `CODEX-CRON-TRIAGE-20261027-01` owner accepts the four exact wrapper/helper/test files, their relationship to the retained v4 pins, and that the 503 failure path needs no migration. The local Yahoo test correction remains unchanged; it was not reverted. Prior local test acceptance does not establish release inclusion or acceptance of those shared cron files.
