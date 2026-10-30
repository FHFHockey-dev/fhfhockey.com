# PC L3: client-bundle check for bd71843dc (orchestrator, TJ-approved local build)

- Build: `next build` of a clean `git archive HEAD web` export at 5ba2117d5 in /private/tmp, with an isolated distDir (.next-playwright) and every outbound connection denied (net-deny preload). Compile succeeded ("Compiled with warnings"). Page-data collection then failed as expected, because static pages need the network (2 denied fetches, both api.nhle.com). There were no production reads and no Vercel involvement.
- Client chunk: `static/chunks/pages/social-share/player-cards-819325104681b5f8.js` (57,670 B).
- Positive control: 11 string literals unique to evidenceLoader, evidenceAdmissions and cardEvidenceVerdict (admission-authority, admission-duplicate, admission-hash, admission-path, appearance-history, authority-exceeds-format, claim-absent, claim-identity, claim-label, complete-official-log, completion-read-rows-v1) appear in exactly 1 server file and 0 client files. The 12th, "appearances", is a common word found in both and is not loader-specific.
- Result: **L3 closed.** The server-only evidence code is not in the browser bundle.
