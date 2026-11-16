# sKO / VuDu statistical foundation review

- Scope: independent statistical and hockey-method review of Fable audit 7174249cb, owner intent, definitions, exposures, time cutoffs, baselines, opportunity and validation requirements. Findings go to the main audit reviewer; no application/source edits or duplicate audit report.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, octoberBranch, starting HEAD 7174249cb7eae7e711039e495c63a990112e22ea. Preserve all pre-existing changes.
- Current state: attached to Tim's Mac, read repository instructions, owner intent and scoped prior diaries. No production/provider/network calls planned.
- Checks: none yet. Next: inspect exact audit and source claims, compute isolated offline counterexamples where useful.
- Blockers/approvals: no production DB, provider requests, writes, deploys or pushes authorized. Tests use only source and synthetic inputs; no holdout data.

## Statistical checkpoint and handoff
- Read owner decisions 32–35, 39, 41, 61, 63, 65, 68, 80; scoped interpreter/gap/legacy classifier and predictor; relevant November 4 and Astra BLSH corrections. Scoped v3 reach inspection only, no duplicate v3 audit.
- Verified offline using AST-selected actual buildPredictionRecord/helpers and in-memory TypeScript transpilation: translation and scale invariance of multiplier, all-one/single-game zero-SD exceptions, VuDu = negative GSAx per 100 matched on-net shots, positive SD below 1 retained. No route import, DB keys, providers, training or empirical holdout reads.
- Synthetic simulation: deterministic seed 7174249, 50,000 stationary Poisson 20-game sequences per rate. Mean multipliers at rates .1/.5/1/2/5 were .914973/.907493/.910150/.912063/.912049 (Monte Carlo SE .00033–.00039). This refutes exact mean-invariance as a correctness invariant and does not establish real hockey prediction quality.
- Main reviewer received corrections to D1/D3/D8 and Q2, distinct recent-unusualness/support/forward-gap estimands, conditional-mean semantics, appearance-share and as-of role-evidence limitations, and v3 scope caveat. No source implementation changes.
- Next: lead integrates findings into the main review; no further work blocked. Synthetic checks passed; no full suite, model fit, production read, network request, build or release ran here.
