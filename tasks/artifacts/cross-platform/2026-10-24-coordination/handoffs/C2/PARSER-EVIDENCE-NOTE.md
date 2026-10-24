# C2 evidence review note: C2-PARSER-EVIDENCE-20261024-001 (CODEX-20261024-034)

- **What this is:** a normal evidence review, done offline with synthetic text only.
- **What did not happen:** no mail or X link was followed, no tweet, queue, provider or production data was fetched, nothing was written to the queue, and no alias was created or resolved. There is no implementation lease and no code change.

## Signal

- **Reported strings:** the alias-alert email for tweet `2114026879136977261` reported three DAL-labelled strings: `Perron`, `Blackwell skating on a fourth line`, `Hryckowian`.
- **Reading:** the second is prose captured as a name, which is an extraction-quality signal.
- **Not verified:** the DAL label is kept as provenance only. Identities, team and queue state are unverified.
- **Where alias alerts come from:** the queue (`lineup_unresolved_player_names`) is filled from parsed `line_N`/`pair_N`/`scratches`/`injured`/`goalie` names that have a null player ID (`collectUnresolvedNamesFromLineRows`, `lineSourceProcessing.ts:318–473`). So the string came from a line/group parser output.

## Offline reproduction attempt

- **Inputs:** 9 synthetic sentence shapes in `parser-evidence/parser-evidence*.ts` and `parser-evidence.log`. They were run through the current `extractStructuredPlayerGroupsFromText`, plus `interpretTweetUnits` for four of them.
- **Prose capture:** **not reproduced.** The current structured extractor trims prose in every shape tried. So the alert likely comes from:
  - a different parser path;
  - a sentence shape not guessed here; or
  - an older parser revision at capture time.
- **Related signal (synthetic only):** shapes like `Perron-Blackwell skating on a fourth line-Hryckowian` come back as a two-player **defence pair** `[Perron, Blackwell]`. That drops `Hryckowian` and labels a forward line as a D pair.

## Suggested next step for the parser owner (not done)

- Use the retained `raw_text` of that one source row (or its sanitized fixture) to find which extractor produced the three-string group.
- Add a regression so prose fragments are never queued as alias candidates. Group-shape validation is a candidate fix.
- Keep the whole phrase out of alias teaching.
