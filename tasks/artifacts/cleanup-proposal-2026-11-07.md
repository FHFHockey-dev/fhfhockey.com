# Checkout cleanup proposal (2026-11-07)

TJ asked for a staged, recoverable cleanup before octoberBranch is pushed. **Status:** stage 1 ran on 2026-11-07, with TJ's changes: the `page-optimization-audit` and `pk-source-audit` reports stay tracked and moved to `tasks/artifacts/`; only the other 126 `output/` files were untracked. See [`ARCHIVED-2026-11-07.md`](ARCHIVED-2026-11-07.md). Stage 2 and `web/web/` were not touched.

- **Exact list:** [`cleanup-proposal-2026-11-07.tsv`](cleanup-proposal-2026-11-07.tsv), 2,330 rows. Columns: path, git state, bytes, sha256, proposed action, reason.
- **Method:**
  - Read-only inventories of `tasks/` media (3,847 files: tracked, untracked and ignored), root `output/` and `web/web/`.
  - An independent re-check found no live doc link to any file proposed for removal. 28 hits were filename collisions; the one real path is a WiGO capture tool's own output target.
- **Archive location:** `~/Archive/fhfh-artifacts-2026-11-07/`, mirroring repo paths, with `MANIFEST.tsv` (path, bytes, sha256). Every copy is checksum-verified before its repo file is removed. This follows the 2026-10-26 precedent (`~/Archive/fhfh-artifacts-2026-10-26/`).
- **Guardrails:** no `git clean`, no `git add -A`, no history rewrite. Tracked removals also stay in git history.

## Stage 1 (proposed now)

| # | What | Files | Size | Action |
|---|---|---|---|---|
| 1 | Regenerable or superseded task screenshots, tracked: iteration and before/after frames with no live doc or receipt reference | 902 | 379 MB | Archive, then `git rm` the exact paths |
| 2 | The same class, gitignored (local disk only; never in git) | 1,290 | 407 MB | Archive, then move out of the repo folder |
| 3 | `web/superstyle-out/shots/*.png` (untracked superstyle captures) | 6 | 0.1 MB | Archive, then remove |
| 4 | Root `output/` runs from 2026-10-02 and -15: `ui-acceptance`, `underlying-stats-320px`, `navigation-verification`, `pk-source-audit`, `page-optimization-audit` | 132 | 59 MB | Untrack and gitignore, keeping the local files. This is the approved CR-REL-03 plan (`fhfh-sprint-ledger-2026-10-22/LEDGER.md:440`). |

Tracked removals by folder:
- `tuesday-trends-2026-10-26`: 799 files, 337 MB
- `social-share-expansion-2026-10-31`: 51 files, 24 MB
- `wigo-visual-pass-2026-10-30`: 49 files, 17 MB. `STEPS.md` links only the composites, which stay.
- `rso-resume-2026-11-01`: 2 files
- `rso-wave2-2026-10-25`: 1 file

An `ARCHIVED-2026-11-07.md` note in `tasks/artifacts/` will point to the archive and manifest, as the 10-26 note does. In-folder `*.sha256` run manifests stay, so the archive copies can be verified against them.

## Kept

- **TJ references** (7 files, including `Q1/references/tj-weapon-ref-*` and the target mockups), plus `output/imagegen` and `output/navigation-mockups`.
- **Live acceptance evidence** (625 tracked files, 283 MB) and doc-linked media (60 tracked).
- **`output/player-resolution-*`:** on hold, because the Master Task List's player-resolution acceptance is still open.
- **`web/web/`:** retained history by owner decision (`repository-audit-remediation/sko-output-provenance.md:7`) and pinned in code (`web/scripts/sko-output-authority.ts`). Removing it needs a new explicit checkpoint.
- **Also kept:** `web/public`, `web/scripts/output`, `web/prep-chef` and `docs/repository-audit`.

## Stage 2 (a decision for later)

453 tracked Tuesday Trends evidence files (234 MB) are cited only by `RECEIPT-1` to `RECEIPT-16`, which later receipts superseded. Archiving them would mean updating those receipts' links.
