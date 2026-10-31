# Lane C receipt: Player vs Player (SS 5.0)

Base `7bddeaf0d`. Commit: see the commit that adds this file on `octoberBranch`.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 5.1 Candidate schema and file | Done | `validateCandidate`, `validateCandidateFile`. Tests: no URL or date refused, off-platform URL, future date, quoted and paraphrased stay labeled, duplicate id. The shipped file has `candidates: []` |
| 5.2 Comparable windows | Done | `comparePlayerWindows`. Tests: different strength, basis or window refused; differing samples disclosed; totals across differing samples printed but not compared; NST coverage admission; pooled per 60 |
| 5.3 Empty and conflicting states | Done | `summarizeDiscussion`. Tests: empty, one post, one-sided, conflicting and no-side all print "No consensus established", with no digit, percentage or majority wording |
| 5.4 Card | Done | `PlayerVsPlayerCard.tsx`. Tests: headline, labels, URLs, limits, and every URL in the alt text |
| 5.5 Assessment | Done | [SENTIMENT-ASSESSMENT.md](../SENTIMENT-ASSESSMENT.md). **Discovery stays blocked**; TJ decides any next step |
| 5.6 Real candidates | **Open** | No candidates supplied or approved, so none were invented. The bounded player-stat read waits with it |

## Checks

| Check | Result |
| --- | --- |
| `npm test -- lib/socialShare/modules/playerVsPlayer.test.ts` | Passed, 34 tests |
| `contract.test.ts`, `server.test.ts`, `PostStudio.test.tsx` with this post registered | Passed (49 tests with the post tests) |
| eslint on my files | Clean |
| CSS-module pure check on `PlayerVsPlayerCard.module.scss` | Passed |
| `npx tsc --noEmit` | 0 errors at the time of the run, repo-wide |
| `playwright test e2e/social-share-comparison.spec.ts --list` | 3 tests listed. **Not run in a browser**: that is the lead's at 13.0 |

## Real reads

**None.** 0 rows read from Supabase, and no reads of Reddit, X or Gemini. The only network use was public documentation pages for the assessment. Column names came from `database-generated.types.ts` and SOURCES.md.

So this post has **no real-input evidence yet**. These source assumptions are unproven on real rows:

- `nst_gamelog_as_counts.date_scraped` is the game date for the join (SOURCES says the join is on date).
- `wgo_skater_stats` rows under the season id are regular season only (CONTRACT §2). The appearance read does not separately filter on `games.type`.

## For the lead

1. **Runtime read size.** The loader reads up to 170 rows from each of `wgo_skater_stats`, `nst_gamelog_as_counts`, `games` and `wgo_team_stats`, only after two players are chosen, and fails closed above that. That is above the 50-row sample bound. LANES says a larger runtime read needs a new approval, so this needs TJ's yes before live use. The example post's loader has limits of 600 and 300.
2. **Shell finding, not changed.** After a server setting changes with no Refresh, `PostStudio` prints the new settings in the footer and token over the old data, so a PNG can mislabel its data. This post guards itself: `hasRows` compares `data.settingsKey`, and the card asks for a refresh. Other posts may need the same guard or a shell fix.
3. **Fit at the limit.** The E2E asserts that the longest allowed claims don't overflow the square. It is the first real test of this layout, since nothing has rendered in a browser.
4. **Basis is `observed`.** `market-observation` was rejected on purpose: hand-picked posts are not a market. If 13.0 wants a different label, the claim wording needs review too.
5. **Player entry is by NHL id.** The shell has no player search, and this lane may not edit it. A sourced pair appears in the dropdown once the file has records.

## Blockers

- 5.6 needs TJ to supply or approve candidates.
- Discovery is blocked by the assessment's findings, and TJ decides.
- Reddit's own terms could not be read (fetch refused), so they are cited through secondary sources and marked that way.
