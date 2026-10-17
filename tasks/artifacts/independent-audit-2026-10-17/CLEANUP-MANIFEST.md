# Cleanup manifest (candidates only; nothing was deleted, moved or archived)

The machine-readable list is [cleanup-manifest.csv](cleanup-manifest.csv): 23 rows with ownership, references, recoverability, a reversible action and the approval each needs. Bytes are measured. For tracked paths they come from `stat` of `git ls-files`; for local paths, from `du -sk × 1024` on 2026-10-17.

| Class | Tracked items | Tracked bytes | Local (ignored) items | Local bytes |
| --- | ---: | ---: | ---: | ---: |
| **Safe**: regenerable, no owner claim, no references | 0 | 0 | 3 (C18 `.next-playwright`, C19 root `.npm-cache`, C23 packed loose objects) | 1.51 GB |
| **Uncertain**: needs owner review | 11 | 319.4 MB | 1 (C20 `.ms-playwright`) | 0.56 GB |
| **Protected**: active, pinned, referenced, or holding unique history | 5 | 199.4 MB | 3 (C17 nested repo, C21 `.venv`, C22 active build dirs) | 7.32 GB |

## Policy

- **Nothing tracked is classified "safe".** Every large tracked tree has an owner statement, a reference, a test pin or an active session.
- The headline candidate, the 78.6 MB npm `_cacache` (C01), is explicitly "intentionally preserved" by the security sprint's diary. It is therefore *uncertain* until that owner signs off. The proposed path replaces it with an integrity manifest, then runs `git rm --cached` and adds a `.gitignore` entry. Local files and history are untouched, and the tarballs stay recoverable from git history at `7f094c8e6` or from the registry by integrity hash.
- Untracking reduces checkout size, including each Vercel build clone. It does **not** shrink `.git` (1.2 GB), and it rewrites no history.
- Age alone is not a reason. "Unmatched" (from the 2026-10-15 reconciliation) is not "obsolete".

## Reversible quarantine procedure (for a later, approved cleanup task)

1. Re-run `git status`, active-session ownership and the reference grep for the exact path. Abort on any change.
2. **Tracked items:** commit the manifest or integrity file, then run `git rm -r --cached <path>` and add a `.gitignore` entry, in one commit. To restore, revert that commit. `git checkout <sha> -- <path>` also restores the content.
3. **Local items:** move to a dated quarantine directory outside the repository with a `restore.json` listing the original path, bytes and SHA-256 per file. Do not purge the quarantine, and do not empty the Trash.
4. **C17 (`web/.next-codex-reconcile`):**
   - First create `refs/heads/archive/next-codex-reconcile-local-snapshot` in the main repo from its `local-snapshot` branch.
   - Verify `git rev-list --count` and that `git cat-file -e 6fcfa8627^{commit}` succeeds.
   - Preserve `.vercel/project.json` separately.
   - Only then apply the existing worktree-cleanup gates: 20-day idle, ancestry and runtime references.

## Not in scope here

The 87 protected paths (11.16 GiB) and the four branch checkouts from the 2026-10-15 review stay under that review's plan.
