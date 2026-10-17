import { useId, useState } from "react";
import type { AcquisitionPeriod } from "lib/rosterScheduleOptimizer/planningTypes";
import { periodLocalTime, resolvePeriodBoundary } from "lib/rosterScheduleOptimizer/periodBoundaries";
import styles from "./RosterScheduleOptimizer.module.scss";

/** Exact boundary edits are applied together; incomplete drafts leave the saved period intact. */
export default function AcquisitionPeriodTimes({ period, leagueTimeZone, onApply }: {
  period: AcquisitionPeriod; leagueTimeZone: string; onApply: (period: AcquisitionPeriod) => void;
}) {
  const zone = period.timeZone ?? leagueTimeZone;
  const [draft, setDraft] = useState(() => ({ timeZone: zone, start: periodLocalTime(period.start, zone), end: periodLocalTime(period.end, zone) }));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const edit = (field: keyof typeof draft, value: string) => { setDraft(current => ({ ...current, [field]: value })); setError(null); };
  const apply = () => {
    const timeZone = draft.timeZone.trim();
    const start = resolvePeriodBoundary(draft.start, timeZone), end = resolvePeriodBoundary(draft.end, timeZone);
    if (!start.instant) { setError(`Exact start: ${start.error}`); return; }
    if (!end.instant) { setError(`Exact end: ${end.error}`); return; }
    if (Date.parse(start.instant) >= Date.parse(end.instant)) { setError("Exact end must be after exact start."); return; }
    if (period.lineupLockAt && Date.parse(period.lineupLockAt) > Date.parse(end.instant)) { setError("Exact end must not precede the existing lineup lock."); return; }
    setError(null);
    onApply({ ...period, start: start.instant, end: end.instant, timeZone, source: "manager" });
  };
  return <details className={styles.settings} open={Boolean(period.timeZone)}>
    <summary>Exact period times</summary>
    <p>Start is included; end is excluded. Changes stay in this form until you apply them. The allowance stays unchanged.</p>
    <div className={styles.ruleFields}>
      <label>Boundary time zone<input value={draft.timeZone} onChange={event => edit("timeZone", event.target.value)} maxLength={200}
        spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></label>
      <label>Exact start<input type="datetime-local" step="0.001" value={draft.start} onChange={event => edit("start", event.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></label>
      <label>Exact end<input type="datetime-local" step="0.001" value={draft.end} onChange={event => edit("end", event.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></label>
      <button type="button" onClick={apply}>Apply exact boundaries</button>
    </div>
    <p>Use an IANA zone such as America/New_York for daylight saving or Etc/GMT+5 for fixed UTC−05:00. Repeated or nonexistent local times require a different unambiguous entry.</p>
    {period.timeZone && <p>Saved boundary time zone: {period.timeZone}. Exact instants are retained when you reopen this period.</p>}
    {error && <p id={errorId} role="alert">{error}</p>}
  </details>;
}
