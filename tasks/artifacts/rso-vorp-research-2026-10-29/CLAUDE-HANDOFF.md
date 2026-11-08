# Claude handoff: RSO drop retention and VORP

Read [RESEARCH.md](RESEARCH.md) for the source links, exact pinned code references, method, limitations and validation milestones. This is a proposal for the RSO owner; it grants no implementation, production, Git or deployment authority. Recheck current ownership/leases and the actual branch before touching shared files.

## Objective

Help RSO recognize that a player with low selected-window fantasy points may be difficult to replace later. A D can be worth keeping over a higher-scoring forward when the manager's actual league pool, scoring, slots, eligibility and usable starts make that true. The model must also be able to conclude that a D is the right drop. Do not add an arbitrary D bonus.

## Design contract

1. Preserve the current selected-window plan result exactly, including its existing units, eligibility and limitations. Model **separately** the later impact of the complete drop/add or stream versus no move, over explicitly named, non-overlapping dates.
2. Compare the roster remaining after every step, including the acquired player, displaced starts, reserves, budgets and locks. The initial test scenario can hold both boundary rosters fixed with no further moves; clearly label that assumption. It measures the resulting roster's opportunity cost, not by itself the difficulty of a later waiver acquisition. A later continuation policy must be symmetric and legal, with no assumed free reacquisition or certain waiver wins.
3. Derive replacement from verified, realistically obtainable league players and their acquisition timing. Use actual eligible slot assignment, not nominal-position shortcuts. Missing/partial pool or projections mean unknown or conditional, not zero. A platform-wide ownership percentage is not a league waiver pool or claim probability.
4. Whole-roster counterfactuals already capture modeled scarcity; do not add a second VORP penalty or double-count multi-position players. Explain replacement options and assumptions separately. Keep no move and a supported safer alternative available.
5. For category leagues, show native-component tradeoffs and compute ratios from pooled numerators and denominators. Keep goalie start/appearance minima and uncertain participation explicit; do not invent win probabilities, calibrated intervals or a universal category scalar.
6. Review every place a better future roster can disappear: drop ordering and the gap chip, bounded candidate generation, weekly-only dominance/representative selection, planner beam/frontier, and independent streaming-chain generation, pair selection and ranking. Report search truncation. Changing `retention.ts` alone is insufficient.
7. Begin with synthetic points fixtures and offline shadow evaluation. Reconstruct historical decision-time inputs and compare paired policies, including no move, without future information leakage. Do not claim validation or automatically change rankings until an owner-approved objective, data coverage and success criteria exist.

## Code evidence and freshness

At research time the referenced RSO code matched commit `fec2ba2d29873525d1bead853ee3ff659b892a5c`; local `master` pointed at `457435eb3010c5b3dd92d2e1a46d9c75d851780a`, a different RSO tree. The detailed links in the research are commit-pinned. `web/hooks/useVORPCalculations.ts` is draft-oriented and is not an in-season waiver baseline. Read the active checkout and leases anew before designing file ownership or implementation.

## Copy-ready request to Claude

> Please review `tasks/artifacts/rso-vorp-research-2026-10-29/RESEARCH.md` and assess how to add player-retention awareness to RSO without changing the meaning of the existing selected-window gain. Propose a bounded, league-specific, whole-transaction future counterfactual, explicit unknown handling, relevant tests, and a search strategy that preserves materially different drop options. Include no move and explain category, goalie, waiver and multi-position limits. Identify the required data and any decisions or permissions before implementation. Do not assume a defenseman bonus, fabricate replacement baselines, edit shared files, or deploy.
