# Frozen Full-NHL H1–H10 denominator (receipt reconstruction)

- `denominator.json`: `forge-full-nhl-h10-denominator-v1`, canonical JSON.
  - `denominatorSha256` = `9c61686e672438d590055dc90697ac2b759ca58971767da5bcf925d4751f1049`
  - file sha256 = `4052d17303b8b2a8ccd93293f28d81404c2ea1f0078777d814073638e2963b9d`
- `summary.json`: counts, Astra's stored-row baseline by horizon, the three trade contradictions, unresolved reasons
  and limitations.
- What it contains:
  - 804 players: 731 skaters, 73 goalies.
  - 8,040 keys across 32 teams and 169 exact NHL game ids.
  - 3 conflicts: Larkin, Dach and Montembeault, where the receipt roster contradicts the 2026-11-22 trade
    reconciliation.
  - 533 unresolved: `roster_not_officially_seen_at_audit`.
- Evidence class is `audit_receipt_reconstruction`. The receipts carry no per-row clocks, home/away or start times,
  so those fields are null (see `limitations`). The dated build path is `buildDenominator`; its input blockers are in
  `../SHADOW-ISSUANCE-PLAN.md`.
- The `../astra-audit-receipts/` subset was copied from Astra's set. Verify it with
  `shasum -a 256 --ignore-missing -c MANIFEST.sha256`.

Rebuild from `web/`. The output is byte-identical:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-h10-freeze-denominator.ts ../tasks/artifacts/forge-full-nhl-h10-2026-11-23/astra-audit-receipts ../tasks/artifacts/forge-full-nhl-h10-2026-11-23/denominator
```
