# Hosted capacity and offline continuity

**November 18, 2026 · Both slots held.** Hosted logs show production activity in both windows. Neither provider supplied a slot-specific resource margin or a scheduler-owner sign-off. Keep 13:46 UTC as the primary candidate and 13:06 UTC as the unbooked fallback. [Schedule comparison and limits](slot-clearance.md)

## Ownership and approval

Vercel returned one confirmed owner, **FHFH (`fhfhockey-dev`)**, on the team serving the `fhfhockey` web project. The Supabase connector confirmed **FHFHockey Development**, Pro, as the organization. Its organization response supplies no member roles. The provider's Members view or its read-only members endpoint can identify the database-side Owner or Administrator. Both project dashboards redirected this browser to sign-in. The K1 Rankings lead can route the clearance through the existing shipping handoff to the Vercel owner and the confirmed Supabase custodian. If one person holds both roles, record that confirmation. The dated capacity decision precedes TJ's separate decision on a canary. [Vercel team](https://vercel.com/fhfhockeydevs-projects/~/settings/members) · [Supabase organization](https://supabase.com/dashboard/org/gradual-silver-60h9gnt/team) · [Member role lookup](https://supabase.com/docs/reference/api/v1-list-organization-members) · [Master task list, read at revision 256](https://chatgpt.com/space/page_227f33dd9ed48191b1b2631bf6c4204c)

## What was observable today

Bounded production reads of Vercel runtime logs and Supabase Logs Analytics returned the following counts. Each interval includes the six minutes preceding the proposed start. Counts cover emitted log entries and include work beyond the named cron routes. One invocation can emit many entries.

| November 18 UTC | Vercel function logs | Supabase gateway logs | PostgreSQL logs | Edge Function logs |
| --- | ---: | ---: | ---: | ---: |
| 13:00–13:10, covering the fallback | 491 info, 1 warning | 1,003 | 52 | 2 |
| 13:40–13:50, covering the primary | 825 info | 670 | 48 | 3 |

Vercel confirmed Observability Plus is disabled. The previous 13:40–13:51 retrospective metrics request returned `payment_required` outside its 30-minute lookback. The drain lookup returned 404 and established no usable sink. Today's counts measure neither invocation concurrency nor function CPU/memory, database CPU/I/O, connection wait or WAL capacity. Fewer Vercel entries in the fallback coincide with more database gateway entries. No load ranking follows. [Historical-query receipt](slot-clearance.md) · [Exact candidate workload](cost-sample.json)

## What continues when the Mac is off

- **Already hosted.** The production schedules, Vercel logs, Supabase logs and built-in reports run independently of the Mac. An authenticated owner can inspect Vercel project reports within the included retention period, with in-function concurrency available where enabled. Supabase Pro retains built-in reports for up to seven days, including average database CPU, memory, disk IOPS and database/pooler connections. Record the chart interval and aggregation: coarse averages cannot clear a four-minute peak. [Vercel project observability](https://vercel.com/fhfhockeydevs-projects/fhfhockey/observability) · [Vercel retention and features](https://vercel.com/docs/observability/observability-plus) · [Supabase project database report](https://supabase.com/dashboard/project/fyhftlxokyjtpndbkfse/observability/database) · [Supabase report coverage](https://supabase.com/docs/guides/observability/reports)
- **No automated capacity receipt verified.** The Master Page returned zero attached automations. The checked-in GitHub workflows contain no collector for these windows. The 13:00 cron report precedes both windows. A Mac going offline leaves no verified job to combine the two providers' telemetry or deliver a clearance.
- **A bounded hosted observation is feasible.** A separately authorized hosted observer with suitable read-only provider access could capture the fallback at **13:11 UTC** and the primary at **13:51 UTC**. Each capture should cover its own preceding 10-minute UTC interval. Retain minute-level resource usage and limits, queue and lock pressure, I/O/WAL, actual start/end times and the largest measured overlap. Record missing series explicitly. Supabase documents a one-minute Prometheus scrape for its richer series; it needs a preconfigured collector to retain history. A hosted timer can run with the Mac off, but a late wake outside the metric lookback must record a missed observation. GitHub scheduled starts can be delayed or dropped. The observer would read workload telemetry only and could never publish, retry a cutoff, or approve the slot. [Supabase Metrics API](https://supabase.com/docs/guides/observability/metrics) · [Hosted timer limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

This review made bounded read-only provider queries and opened two dashboards. It registered no observer or publication schedule, changed no plan and sent no external message.
