# C7 review R47 (pre-release): `605ecbb85` (category summary count, opponent hint) and release candidate `refs/rc/2026-10-26-web-7` (`da53bf311`)

**Verdict: accept. Nothing must change before release.**
- `605ecbb85` closes R46 C1 and U1. Category mode shows a W·L·T·unknown count, never a blended score. The opponent hint and "No games remaining" fill write explicit zeros. Points mode is unchanged.
- **The release candidate is scoped exactly as described**, its included files don't depend on any left-out Tuesday Trends change, and its producer closure is **`87edd78f`**, which is now allowlisted with a matching commit-backed receipt.
- It also closes R44 P1 and P2 and R46 G1.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I used `git archive` snapshots at `/private/tmp/c7-r47` (the release candidate, with its `web/`, `supabase/` and `tasks/` trees, and the parent of `605ecbb85`).
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_PROJECTION_DAYS_AHEAD`, `FORGE_RESERVE_PASS_ENABLED` and `RSO_YAHOO_DIET` unset.
- Evidence is in `r47-evidence/`.

## 605ecbb85

- **Summary metric:**
  - In category mode the value is `categoryTally(categoryResults)`, for example "4 W · 3 L · 2 T · 1 unknown", with the detail "Categories projected won · lost · tied (a count, not a score)".
  - When every category is unknown it shows **"Unknown"** with the reason: no opponent ("Add opponent totals…"), remaining missing or null ("…enter 0 where nothing remains"), or projections not covering ("Projections don't yet cover these categories.").
  - No scalar is computed or shown.
- **Points mode:** `tally` is `null`, so the value is `number(projectedValue)` with the same "Shows once…" or "League scoring, active games only" detail as before.
- **Matchup setup:**
  - A hint: "Enter every opponent remaining total, using 0 when nothing remains. A missing remaining total leaves that category unknown."
  - A "No games remaining" button that writes **explicit 0** for every key named by opponent realized, opponent remaining, or the league's category numerators, denominators and keys. That's a deliberate manager action, so it never assumes zeros silently.
- **Tests:** the 4 new cases (counts, the two "Unknown with reason" variants, and the hint plus zero fill) **fail on the parent** (`7723772`, 221/225) and pass on the release candidate.

## Release candidate `da53bf311` (`master 0b21422db` plus the RSO/FORGE files)

| Check | Evidence | Result |
| --- | --- | --- |
| **Scope** | `git diff --name-only 0b21422db da53bf311` lists **42 files**. The union of files touched by `e2038b17a`, `6c36c8e8c`, `08e583311`, `becf20851`, `5aa3f8711`, `4ed3a6220`, `5aa9ba5e0`, `1da7239c4` and `605ecbb85` is **the same 42 files** (`comm` is empty in both directions). **All 42 are blob-identical** to `605ecbb85`'s versions. | Exact |
| **Does an included file depend on a left-out Tuesday Trends change?** | 47 `web/` files differ between the release candidate and `605ecbb85` (the left-out Tuesday Trends work and the like). I resolved every static import, re-export, dynamic import, `require` and `vi.mock` in the 24 included code and test files (`r47-deps.cjs`): **none** resolves to a differing file, and none is unresolved. **None** of the 47 is in the producer closure. **Run:** the 14 relevant suites on the release candidate tree pass **940/940**, including the RSO component, categories, planning, reproducibility, bridge, RSO data route, pipeline, Yahoo planning and diet, proof, allowlist, and **`supportedBaselineMigration`**. | No dependency |
| **Is the producer closure `87edd78f`?** | The committed scanner on the release candidate's `web/` gives **`87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97`**, 194 modules, **0 findings**. The allowlist **lists it** (`1da7239c4`): commit `5aa9ba5e0…`, receipt `5aa9ba5e0….json`, whose sha256 **`7b501589…aea8`** matches `receiptSha256`. The receipt declares `sha 5aa9ba5e0…`, `verified`, 0 findings, closure `87edd78f`, 194 modules, and no `source`. (R46 found `87edd78f` at `5aa9ba5e0`.) | Yes. **R46 G1 closed.** |
| **R44 packaging issues** | The release candidate now carries `tasks/artifacts/.../release-verification/` (all allowlisted receipts plus the negative `bd337d97a`) and 101 migrations, with the authority JSON, so `verifiedForgeReleases` and `supportedBaselineMigration` pass on the candidate tree. | **R44 P1 and P2 closed** |

**Not checked by me:**
- Whole-project `tsc` and lint on the release candidate. My dependency check is import-resolution based, plus the 940 passing tests; TypeScript errors in files with no test coverage would need tsc.
- The FR18 Playwright spec (discovery only in R46).
- A production build.

I recommend the orchestrator's usual tsc and lint gate on `da53bf311` before release, as for earlier candidates.
