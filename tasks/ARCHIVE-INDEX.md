# Local task archive and retained evidence policy

This checkout was reconciled from production `0619f912` plus the preserved pending checkpoints at application baseline `1ee5127dc22c34ef9658f96ed4d72823b1d5ea29`. Historical task material was archived reversibly on October25,2026; placement in the archive does **not** mean obsolete, completed or unimportant. BLSH is P1; related sustainability/SKO/VuDu research remains available through the location map below. No source integration, production/model activation or data repair is authorized by this index.

## What stays in Git and in the checkout

Canonical plans/master/ledgers, required source/fixtures, current coordination mailboxes and leases, current C1/C2/C3/CODEX-REVIEW handoffs, accepted goalie receipts, final release receipts and current development-context notes are retained. Current review packets remain immutable and patches remain unapplied. Diary snapshots are development context, not application release deliverables; exclude them from future production candidates.

The local player-card preview runtime is preserved. Exact generated HTML, current screenshot/output folders and package/Vite cache directories have narrowly scoped ignore rules. Their source, patches and human receipts remain visible. No blanket tasks ignore or private capture publication was used. Private configuration and inherited ignored caches stay local.

## Recovery archive

Archive root on TJ's Mac:
`/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505`

- `FILE-MANIFEST.json`: every original relative path, disposition, SHA-256, byte count and mode; SHA-256 `d5eba4945cac846d9bb2a7261bfc3d186bf69b1c4e4d72faf3371c31bc2265da`.
- `files/<original-relative-path>`: verified current snapshot, including protected local outputs. The historical subset contains 12601 reversibly moved files. Nothing unique was permanently deleted.
- `ARCHIVE-JOURNAL.jsonl` and `ARCHIVE-STATE.json`: actual movement receipts.
- `BLSH-RESEARCH-LOCATIONS.json`: direct original/archive paths for 110 BLSH/sustainability/SKO/VuDu research inputs; canonical product plans and source remain in the checkout.
- `RESTORE.py`: defaults to a dry run; refuses to overwrite a differing destination and never removes the archive copy.

Historical relative links in older plans refer to the original paths recorded in this manifest. Restore an individual referenced artifact when needed rather than rebuilding old outputs or assuming missing work. If this archive is not on another machine, obtain the owner's verified archive copy; it is intentionally not a Git dump of private captures and bulky execution evidence.

Example dry run (replace the relative path with the required artifact):

```sh
python3 /Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505/RESTORE.py tasks/artifacts/example/REPORT.md
```

Add `--restore` only for the exact required path. Restoration or new work naturally creates a new working change. A clean checkpoint does not mean future development files should be hidden or discarded.

## Publication boundary

Only an ordinary fast-forward of `octoberBranch` is approved for this cleanup. No master push, PR merge, force-push, deployment, provider/DB call or model activation. Vercel previews are disabled on all four linked projects; their production branch is master. The tracked GitHub workflow is manual-only. Recheck these settings if publication scope changes. Source write leases remain sequenced after the coordinator's final verified handback.
