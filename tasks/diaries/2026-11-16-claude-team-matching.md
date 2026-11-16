# 2026-11-16 · Claude · team matching (Ontario → COL, Hallander "in Philadelphia")

## Scope
Offline fix for two post-to-team bugs in `web/lib/sources/linesCccIngestion.ts` (Codex audit 11-16):
1. AHL Ontario Reign lineup assigned to COL — league filter must reject as non-NHL.
2. "Hallander … in Philadelphia" assigned to PHI — opponent/location mentions must not become the team (nor queue alias prompts).
Seven pending wrong-team alias prompts: do NOT touch, no alias data writes. No prod/X/Browserless, no push.
News-card session owns newsLineup*, newsFeed, tweetNewsAutomation, NewsFeed/*, tweetInterpretation, tweetPlayerEvents.

## Where
- Branch `octoberBranch`, base `b296d52af`.
- Files: `web/lib/sources/linesCccIngestion.ts`, `web/lib/sources/linesCccIngestion.test.ts`.

## State
- Retained post text not found locally (tasks/, coordination handoffs, tweet-news corpus is July-only, ~/.codex). Using synthetic fixtures.
- Alias prompts come from `collectUnresolvedNamesFromLineRows` (lineSourceProcessing.ts) on accepted rows with team_id → fixing the team fixes the prompt.
- Path found: single label match ("Colorado" / "Philadelphia") → `textHintTeam` fallback in `resolveLinesCccTeam`.

## Plan
- League: detect AHL full club names (Colorado Eagles, Ontario Reign, …) in `detectNonNhlLeague`; add `ontarioreign` handle hint. Full names only — existing Wolf Pack test expects bare "Wolf Pack" quote under a "Rangers lines" relay to stay NHL.
- Opponent: strip "vs/versus/against/at/@/in <team label>" before label fallbacks (keep "at X practice/skate"); add "in" to lead-player cues.

## Checks
- New describe "team matching: league and opponent mentions (Codex audit 2026-11-16)": 4 tests, red on HEAD (Ontario→COL, Hallander→PHI), green after fix.
- `npm test -- lib/sources`: 51 files passed, 1 skipped; 1340 passed, 39 skipped. Scoped eslint exit 0. `npm run typecheck` exit 0.

## Next
Committed 2786b0f0f (amended dfbc210c4) (2 web files; diary not committed). Report to parent. Seven pending alias prompts untouched.

## Gotchas
- `update-lines-ccc.ts:152` auto-ignores pending prompts on a tweet re-accepted under another team: a replay would touch the seven prompts.
- Team change alters interpretation input → TWEET_INTERPRETATION_VERSION may need a bump (flag, don't bump).

## Final (after advisor review)
- Opponent rule changed from "strip then promote" to "veto only": a cue-only team is never the label answer but still counts toward ambiguity (stops "COL Blackwood vs MIN Wallstedt" → COL). Keep-cases: lineup/lines/net/crease/goal/practice/optional, "<word> skate/camp"; contract posts keep "in <team>".
- AHL rule guarded: if an NHL club is named in words (not just a tag), the post stays NHL (corpus: Mammoth signing from Rochester Americans).
- Offline corpus diff (web/scripts/output/tweet-news-phrase-audit/tweet-corpus.json, 3486 texts, empty rosters, interpretation off): 59 flips, all accepted → rejected_ambiguous; nearly all were wrong-team filings. Right-team losses: "Eriksson Ek skated today in Minnesota", "Reilly Smith … back in Vegas". Scratch files deleted.
- Final: file 76/76; lib/sources 1340 passed / 39 skipped; eslint 0; typecheck exit 2 only from run-rolling-forge-pipeline.ts:1083 (another session's uncommitted FORGE edit, not mine).
- Open for TJ: affiliation via bare nickname + tag ("Reign lines #GoKingsGo") still → LAK; the Wolf Pack test pins that. Density still gives +2 for a cue label (unverified with real rosters). AHL club list from memory.
