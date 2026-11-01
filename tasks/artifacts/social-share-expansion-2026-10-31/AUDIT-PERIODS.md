Reviewed the requested changes at `2aa77ee0a` against `f17bea20d`.

1. **Medium — Refresh can load a different week than the period control displays.**  
   [PeriodControl.tsx:20](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/PeriodControl.tsx:20) fetches the calendar and cutoff only on mount or retry. [PostStudio.tsx:169](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/PostStudio.tsx:169) refreshes the edition without refreshing that cutoff.

   **Reproduced using the committed components in memory:** open Team Games with `period=matchup` and a blank week before Monday, November 2, 2026, midnight in New York. After midnight, click **Refresh post**:
   - Pager remains **Week 3 · Oct 19–25**.
   - Card loads **Week 4 · Oct 26–Nov 1**.
   - **Download PNG remains enabled.**
   - “Prior week” targets **Week 2**, skipping the actual card’s preceding week.

   The calendar was fetched only once. Refresh should synchronize the control’s cutoff with the edition, or pin the resolved week explicitly.

Verification: **57 in-memory assertions passed**, covering legacy URL parsing across all 13 modules, New York/DST and 14-day boundaries, Standouts baseline exclusion, ADP season/identity handling, bounded-read rejection, and mocked route authorization. The rollover failure was reproduced separately in a simulated DOM.

**Counts:** blocker **0**, high **0**, medium **1**, low **0**.

**Couldn’t verify:** live database contents/counts, provider freshness, deployed authorization, browser layout, or actual PNG capture. No files were written; no network services, builds, or servers were used.

Codex session ID: 01a198a4-abba-7c21-8f1b-53e24a563cca
Resume in Codex: codex resume 01a198a4-abba-7c21-8f1b-53e24a563cca

---

Lead's disposition: fixed. Each new edition rereads the matchup calendar, so a blank week's pager follows Refresh over midnight; test in `PostStudio.test.tsx`.
