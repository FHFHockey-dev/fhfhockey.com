# Team Stream (Social Share post) — context diary

- **Scope:** new post "Team Stream" in `/social-share/posts`: window (RoW / matchup / custom), left-rail panel of the top 8 Week Score teams, 1080 card for the selected team.
- **Where:** `octoberBranch`, local commit `83847b3fe` (not pushed). 15 files: `web/lib/socialShare/modules/teamStream{,.sources,.test}.ts`, `web/components/SocialShare/modules/TeamStream{Card.tsx,Card.module.scss,Panel.tsx}`, `web/e2e/social-share-team-stream.spec.ts`, `lanes/schedule.ts`, `offNightEdge.ts` (export-only split: `offNightPools`, `formOf`), `landingCatalog{,.test}.ts`, `postedWeek{,.test}.ts`, two example webps.
- **TJ decisions (pop-ups, 11-06):** FP/GP delta default + dropdown; 8 teams; 3 players; best available keeps 1+ D; peripheral focus (mix/HIT/BLK/PIM/SOG); band above the schedule rail; fixture and real-data renders approved; tiles on Mon and Wed (two tiles, since each tile lists under exactly one day).
- **Checks:** 17 Team Stream tests, 1,312 Social Share tests pass; typecheck exit 0; eslint clean; scss pure; e2e passes on a scratch clone (:3130, stopped). Granlund's L5/FP/ixG/TOI matched a SELECT spot-check exactly.
- **Next:** Chef's integration and release gate. No push, no build.
- **Gotchas:** studio URL must carry the edition's settings or export holds ("Settings changed"); zsh needs arrays for pathspec lists; real-data harness = Vitest in the scratch clone (`// @vitest-environment node`, public client, env read in-process).
