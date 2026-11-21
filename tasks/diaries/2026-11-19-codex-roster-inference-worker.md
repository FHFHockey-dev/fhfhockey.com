# Dated, roster-scoped player inference

- Local on octoberBranch, starting at 62ce797ad. Own the pure inference helper and focused unit tests. Parent owns ingestion and review integration. Use only publication-valid roster inputs and independent team evidence.
- Next: implement evidence/section handling, uniquely resolved initials and review-only fuzzy/beat/ambiguous candidates. No external reads, writes or deployments.
- Integrated contract uses unique_initials for auto. Global lexical collision checks protect dated approved aliases, role-scoped aliases and surnames. Opponent/city, lower-league, quoted and mixed-case occurrences cannot create an automatic player identity. Ambiguous surnames keep rivals; single-coverage beat is review-only.
- Moved the two unchanged lexical algorithms into tweetNameLexicon.ts to keep node:crypto out of shared imports. Focused inference, existing candidate checks and scoped TypeScript passed.
- Final coverage includes the ordinary comma-and teammate list and explicit opposing verbs such as “face” and “taking on”. 41/41 tests, scoped ESLint and TypeScript passed. Local changes handed to parent for shared processor and consumer verification.
- Parent requested a read-only normal-path review of dated roster inference, aliases, beat evidence and serialization. Checking a bounded counterexample before reporting.
- Integration review returned two reproductions to Chef. A post-publication alias could suppress a valid initialism injury, add a second News player, or create a historical injury. A surname collision also bypassed the inferred-reporter-history lookup. Exercised direct build, refresh and row conversion locally in a disposable probe. Production and shared integration files were untouched.
- Chef requested exact shared surnames and reviewed aliases disambiguated by independent team evidence. Add span-only scopedNames to pure helper and verify same-side, role, history and beat controls.
- Scoped exact names and teammateTeamId handed to Chef. Span, alias, opposing occurrence, roster/role collision, mixed history and source-only controls passed all 18 cases. Targeted ESLint passed. Chef owns event/row integration.
