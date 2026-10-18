# Rights and redistribution checklist — S-15, 2026-10-18

Lists each source by actual use. Every "Owner answer" cell is for TJ to answer; nothing here is policy text or a legal conclusion. Status values: **verified** (local evidence in the repo), **open** (owner fact needed), **n/a**.

## By source

| # | Source / asset | Used how | Intended use if released | Evidence in hand | Status | Owner answer needed |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | NHL schedule, `api-web.nhle.com/v1/schedule/{date}` (undocumented web API) | Server reads; derived counts, off-nights, matchups, start times and FHFH Schedule Score | Public PNG posted to social accounts, plus the noindexed studio page | The Oct 8 review read nhl.com Terms of Service sections 2 and 7 as restricting automated collection and redistribution. No API-specific permission or license is on file. Not re-read in this lane (no external access). | **open** | Does FHFH have permission or a license to redistribute derived NHL schedule facts in images? If not, is it acceptable to post derived facts only, with no NHL marks? Who confirms? |
| R2 | NHL and team names and abbreviations (text only; no logos) | Rendered in the image and alt text | Same | No NHL or team logo assets are bundled; names come from `lib/teamsInfo` | **open** | Is nominative use of team names acceptable for FHFH's accounts? |
| R3 | Fonts: Roboto Condensed, Train One, Martian Mono | Embedded in the PNG via `@font-face` | Same | SIL OFL 1.1 license texts are shipped beside the font files in `web/public/fonts/social-share/` and are byte-identical to the reviewed package | **verified** | — |
| R4 | FHFH logo `web/public/pictures/logo-fhfh.svg` | Brand row | Same | FHFH's own repository asset | **open (assumed owned)** | Confirm FHFH owns the logo and may use it on these accounts. |
| R5 | `calcWeekScore` Schedule Score (FHFH method) | Displayed as "Schedule Score" | Same | FHFH code | n/a | — |
| R6 | Odds / `expected_goals` win odds | **Not used** (`includeOdds: false`; unit test asserts no odds fields) | — | Test-enforced | n/a | — |
| R7 | Ownership data (Yahoo or other) | **Not used** by the installed formats | Future Mon/Tue editions | None for redistribution | **open** | Which ownership provider, under what terms, may FHFH show? May single-provider ownership be shown, and how must it be attributed? |
| R8 | Player stats, lines and deployment (NHL, NST, others) | **Not used** | Future Tue/Thu editions | None | **open** | Per-provider redistribution terms (NST requests also stay ≥ 21 s apart). |
| R9 | FORGE projections | **Not used** | Future recommendation editions | Internal model; release acceptance is in progress in the core lanes | **open** | When, and under what wording, may projections appear in public images? |

## Operator, destination and privacy facts (owner only)

| # | Question | Status |
| --- | --- | --- |
| O1 | Which accounts or destinations (X, Bluesky, Instagram, Reddit, newsletter, blog)? Who operates each? | open |
| O2 | Who approves each post (content and destination), and is approval per post or per edition? | open |
| O3 | Is automatic posting ever allowed? (Currently unapproved; the IFTTT lane is separate.) | open |
| O4 | Should images or alt text carry an attribution or disclaimer line? Exact wording must come from the owner. | open |
| O5 | Privacy: the installed formats contain no user, league or account data (API test asserts private fields are dropped). Any future "your team" or league image needs an owner decision on what may leave the account. | open for future formats |
| O6 | Data retention for exported PNGs and edition ids | open |

## What this lane did not do

No fresh source retrieval, no NHL or provider calls, no posting, no DB or Vercel access. Sample exports use fictional matchups and are stamped **SYNTHETIC FIXTURE · NOT CURRENT NHL DATA · NOT FOR POSTING**.
