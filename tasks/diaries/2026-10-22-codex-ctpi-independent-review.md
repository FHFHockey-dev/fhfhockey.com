# CTPI independent correction review

- Scope: review the two-file CTPI correction, source artifact `tasks/artifacts/ctpi-duplicate-upsert-audit-2026-10-22/FIXED-HANDOFF.md` and `candidate.patch`. Check exclusion before normalization, destination key validation before writes across batches, formula/cohort preservation and legacy gates.
- Where: canonical `octoberBranch`; review only. NST R1 remains separately accepted and will not be rerun. Other owners' files preserved.
- Start: reading packet and route/test diff; no source edits or database execution authorized. No production/NST/network calls, secrets, commits or deployment.
- Next: freeze/hash actual source and run isolated imported-code plus adversarial offline cases on Node 22.11.0/npm.
- Deliverable: distinct receipt under `tasks/artifacts/ctpi-independent-review-2026-10-22/`.
- Blockers: none at start.
