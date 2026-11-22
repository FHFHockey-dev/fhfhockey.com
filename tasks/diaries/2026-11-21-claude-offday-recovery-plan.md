# recovery-plan lane · Nov 21 forecast recovery (fork of Chef local_091a3ca0)

- Scope: design the narrowest safe recovery so the unstarted Nov 21 games get a daily forecast; read-only. No writes, route calls, resets or NST requests.
- Where: octoberBranch working tree, no git mutations. Outputs: `tasks/artifacts/daily-offday-release-2026-11-21/recovery/RECOVERY-PLAN.md` and `QUERY-LOG.md`.
- Result (17:45Z): Option B, a single scoped `run-projection-v2?date=2026-11-21&gameIds=<13 unstarted>`. No reset, no pipeline call, no deploy dependency. 13 games recoverable at 19:40Z and 20:00Z; latest safe start 20:10Z.
- Option A rejected: a full-slate run displaces the live 0359 record in both readers; the derived backlog would likely fail at stage 7 on the 0357 manifest; and it has a wider blast radius.
- Gotchas:
  - Ingest has its own 09:45Z cron, so Nov 19 and Nov 20 are complete.
  - Derived 10:25Z cron deferred 2026-11-19 on game 0357 (SEA/VAN manifest).
  - Never change `gameIds` between resume calls: it changes the scope key and starts a second run.
  - Census: 0 null game_id or season in the 1095-day window.
- Next: the parent Chef integrates this into the 19:30Z packet. Follow-ups: the 0357 relationship/derived gap; the Start Chart pregame-publication fence question.
