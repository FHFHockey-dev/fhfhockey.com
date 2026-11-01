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
| 5.6 Real candidates | **Open by TJ's decision** | TJ decided, relayed by the lead on 2026-10-31: manual reviewed records are the design, and TJ adds candidates later. So 5.6 stays open, discovery stays blocked, and the shipped file stays empty. The bounded player-stat read waits with it |

## Layout pass (TJ's review: fill the space, less meta text)

- The card is now a head-to-head stat block across the full width: value, label, value. Its rows take all the height the discussion leaves, so the body has no spare band. Filled tiles mark the higher side.
- With no posts or few rows, the type grows: 30px, 46px or 130px values. A one-row power-play view is one tall tile, which meets the rule by fill. TJ may prefer something else there.
- Two claims sit side by side under the headline.
- On the card: player names, GP, window and basis, "No consensus established", claim text, claim URLs, quoted or paraphrased labels, and one legend line (`pvpLegend`).
- **Judgment call:** the legend also carries a short "Hand-picked posts, not a market price or a poll". Without it, a PNG shared alone could read a one-sided pair of posts as opinion at large.
- Moved off the card to `evidence.cohort`, which prints on the page, and the alt text: why this pair, the discussion note, the full caveat, samples, positions, teams, and coverage notes.
- Per-post limitations and the claims the card doesn't show are in the alt text only.
- New refusal: a URL over 200 characters. URLs had no limit, and an unbounded one could clip the card.

## Head-to-head bars (TJ's review of a real pair, 2026-11-01)

This replaces the filled tiles and type sizes described above.

- Each stat row is value, bar, label, bar, value. Bars grow outward from the centre label, sized by `pvpBarShares`: that side's share of the pair's combined value.
- The higher side is bright, and a printed tie is an even split with both sides bright, even if the unrounded values differ.
- A zero has no width but still prints. A missing value is a dashed gap printing "—", and its opponent gets no bar either, because a share of an unknown total means nothing.
- **Judgment call:** totals over differing samples draw no bars. They stay uncompared, as `comparePlayerWindows` already rules, and the legend says so.
- With no posts, "No consensus established" is one 17px line. With posts it stays 34px.
- `playerVsPlayer.candidates.json` is unchanged. TJ gave the pair with no URL, so it has no sourced record.
- Value type is now 30px, 46px or 84px, so a value column leaves room for the bar.

## Checks

These are the latest run, after the bars.

| Check | Result |
| --- | --- |
| `playerVsPlayer.test.ts`, `contract.test.ts`, `server.test.ts`, `PostStudio.test.tsx` | Passed, 61 tests |
| eslint on my TypeScript files | Clean |
| CSS-module pure check on `PlayerVsPlayerCard.module.scss` | Passed |
| `npx tsc --noEmit` (with an 8 GB heap; the default heap crashed) | 0 errors, repo-wide |
| `playwright test e2e/social-share-comparison.spec.ts --list` | 4 tests listed. **Not run in a browser**: that is the lead's at 13.0 |

**The fill is unproven.** Type sizes come from arithmetic on the 860px body, not from a render. The spec's `expectFills` checks for clipping and for bands over 40px, using 240-character claims and 200-character URLs, at 13.0.

## Real reads

**None.** 0 rows read from Supabase, and no reads of Reddit, X or Gemini. The only network use was public documentation pages for the assessment. Column names came from `database-generated.types.ts` and SOURCES.md.

So this post has **no real-input evidence yet**. These source assumptions are unproven on real rows:

- `nst_gamelog_as_counts.date_scraped` is the game date for the join (SOURCES says the join is on date).
- `wgo_skater_stats` rows under the season id are regular season only (CONTRACT §2). The appearance read does not separately filter on `games.type`.

## For the lead

1. **Runtime read size.** The loader reads up to 170 rows from each of `wgo_skater_stats`, `nst_gamelog_as_counts`, `games` and `wgo_team_stats`, only after two players are chosen, and fails closed above that. That is above the 50-row sample bound. LANES says a larger runtime read needs a new approval, so this needs TJ's yes before live use. The example post's loader has limits of 600 and 300.
2. **Shell finding, not changed.** After a server setting changes with no Refresh, `PostStudio` prints the new settings in the footer and token over the old data, so a PNG can mislabel its data. This post guards itself: `hasRows` compares `data.settingsKey`, and the card asks for a refresh. Other posts may need the same guard or a shell fix.
3. **Fit at the limit.** The E2E asserts the fill and no overflow at the longest allowed content. It is the first real test of this layout, since nothing has rendered in a browser.
4. **Basis is `observed`.** `market-observation` was rejected on purpose: hand-picked posts are not a market. If 13.0 wants a different label, the claim wording needs review too.
5. **Player entry is by NHL id.** The shell has no player search, and this lane may not edit it. A sourced pair appears in the dropdown once the file has records.

## Blockers

- 5.6 stays open until TJ adds candidates, as TJ decided. Nothing is needed from this lane.
- Discovery stays blocked, as TJ decided.
- Reddit's own terms could not be read (fetch refused), so they are cited through secondary sources and marked that way.
