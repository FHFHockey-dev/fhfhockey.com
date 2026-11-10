# October consolidated release candidate — November 10, 2026

## Included

- RSO input readiness now asks for relevant missing or assumed values, remembers value-scoped manager answers, and keeps explicit local plan selection. Existing forecast, budget, legality and provider boundaries remain. Includes navigation skeleton, bounded access retry and saved-workspace schema corrections.
- Homepage uses one direct season lookup and overlaps independent reads. Public Transaction Trends deduplicates requests and briefly caches public source data. Local untouched-tab hydration improved from 3.141s to 2.053s. The cold trend history scan remains about 11 seconds; cached process-local response was 0.083s. No production speed guarantee.
- Rankings reader corrections cover team season bounds, goalie official-appearance population/workload/provenance, and team token resolution in comparisons/snapshots. Broader primary-source completeness, projection freshness and performance acceptance remain follow-up work.
- BEAST/MCM complete-component and complete-population publishing guards, provenance and bounded atomic upsert. The repair preparation tool has no write mode. No source repair or composite publication is performed by this release.
- BLSH evidence-only local preview selection and inert capture/preparation tooling. Production trade-page gate and capture-execution/independent-acceptance gates remain unchanged.
- Reviewed offline qualification-checker fixes and safe archival tooling/docs.

## Verification

- 358 focused Rankings, BEAST and BLSH unit cases passed across 15 suites; scoped ESLint passed.
- 63 homepage cases passed; scoped ESLint and untouched-tab local browser checks passed.
- 351 distinct RSO unit cases and 13 synthetic Chromium scenarios passed; lint has zero errors and six pre-existing hook warnings.
- 101 distinct offline qualification-checker cases covered. Two CLI stderr JSON cases required suppressing the runtime's experimental proxy warning; the affected 20-case file then passed. No source workaround.
- Combined repository TypeScript passed with an 8 GB, nonincremental check. The separately pending workspace schema passed all 54 regression cases. Final owner pins and staged bytes were verified. No local production build was used merely for reassurance.

## Release boundaries

The candidate contains reviewed application/test/tooling work only. Private responses, account/league evidence, browser output, generated reports, baseline backups, Git index snapshots, archives and diaries remain unchanged locally. The standalone destructive goalie-data SQL is not included or executed. No credentials, migration, schedule, feature flag or provider write is part of this release. All histories are preserved while master and octoberBranch are synchronized.

Target: origin/master and origin/octoberBranch at the same candidate, deploying fhfhockey Production (web root). Existing project settings predict one completed web build and three ignored companion entries. No preview, duplicate build, live BLSH capture or authenticated Yahoo acceptance is requested.
