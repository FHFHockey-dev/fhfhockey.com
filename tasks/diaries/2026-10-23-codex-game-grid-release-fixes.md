# Game Grid release fixes — October 23

Scope: parent-authorized sparkline disclosure correction and reproduced schedule/cancellation/cache retention defects; local only. Preserve score formulas, forecast boundaries, palette/design and concurrent work.

Start: canonical octoberBranch HEAD 431ffcd673b42ad4a149dc3f9dfb03005dbec75a. Game Grid source/test paths currently clean; unrelated dirty work preserved. Read AGENTS.md, SPRINT-MODE.md, independent review REPORT/HANDOFF and optimization audit REPORT/REPRODUCE.

Reviewer 01a168ae-fd25-7463-86cc-9bf261dbb031 owns only its read-only snapshot. Exact hover oracle requires original card ID persist across trigger→card, not generic visibility. Root cause: immediate trigger leave plus pointer-events:none and outside-dismiss checking trigger only.

Requested exact source lease from release lead 01a1637a-4222-70c0-8439-cb3cc46b20c4 before edits to shared readers/cache. Planning minimal odds-aware reuse, bounded shared reads and subscriber cancellation; no server/API change.

Next: reproduce locally, implement owned paths, focused synthetic tests/browser, pinned patch for independent review. No new app edits/tests yet; no production calls.

Checkpoint: release lead confirmed declared paths unowned. Exact original-card hover oracle reproduced red, then passed after interactive portal-region fix. Two cancellation regressions reproduced red (post-unmount/new-date continuation), now pass. Cache expiry/cap probes reproduced two failures, now pass. Initial focused 30/30 plus combined-client 5/5 and three browser checks pass; tap/focus follow-up also exited 0. Shared read helper uses 30-second bounded public cache, preserves odds-superset rule and per-subscriber cancellation. Combined initial 7/10-day hooks now 4 schedule HTTP calls + 1 team call. 7→10 after fixture-only week 2 intentionally needs one odds-bearing upgrade; no conflated cache keys or server changes.
Next: final scoped checks/diff and reviewer packet. No production calls, commit/push/deploy.

Handoff: 13 changed source/test paths pinned in /Users/tim/Documents/Codex/2026-10-22/task-3/evidence/release-fixes/CANDIDATE.json with packet.patch, corrected copies and REPORT.md. 49/49 focused unit tests, final 5/5 Chromium cases, scoped no-emit TypeScript, scoped ESLint (zero warnings) and diff check pass. Two disclosure unit tests rerun after callback stabilization; counts not added. Desktop synthetic original-card screenshot visually inspected. All test processes finished; fixture port 3112 released by runner. No denied/pending/uncertain execution. Independent recheck pending, no push/deploy. Release lead owns integration; source lease may transfer with pinned packet. Separate nonblocking Info colour-key mismatch remains outside lease.
