import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMatchupWeeks } from "lib/socialShare/matchupWeeksFetch";
import type { AnyShareModule, ShareSettingField, SharePostSnapshot, ShareSettings } from "lib/socialShare/modules/contract";
import { customRangeLimits, customRangeReason, editionCutoff, matchupCalendar, matchupPager, PERIOD_CUSTOM, PERIOD_MATCHUP, periodSettings, resolvePeriodWindow, type PeriodControl as PeriodControlConfig } from "lib/socialShare/modules/shared/periodWindow";
import styles from "./PostStudio.module.scss";

type Props = {
  entry: AnyShareModule; control: PeriodControlConfig; settings: ShareSettings; disabled: boolean;
  /** The loaded edition: each new one rereads the calendar, and the pager's blank week and limits use the cutoff it was built against. */
  edition: SharePostSnapshot | null;
  /** Sets a field and waits for Refresh, as the settings form does. */
  change: (field: ShareSettingField, text: string) => void;
  /** Sets fields and loads their edition at once. */
  apply: (changes: ShareSettings) => void;
};

/** Period select, a pager over this season's matchup weeks, and date fields for a custom range. */
export default function PeriodControl({ entry, control, settings, disabled, edition, change, apply }: Props) {
  const [source, setSource] = useState<Awaited<ReturnType<typeof fetchMatchupWeeks>> | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const priorButton = useRef<HTMLButtonElement>(null), nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    void fetchMatchupWeeks().then(result => { if (live) { setSource(current => result ?? current ?? null); setRefreshFailed(result === null); } });
    return () => { live = false; };
  }, [attempt, edition]);
  const calendar = useMemo(() => source ? matchupCalendar(source.rows) : null, [source]);
  const field = (id: string) => entry.fields.find(item => item.id === id)!;
  const period = field("period"), matchupValue = control.matchupValue ?? PERIOD_MATCHUP, current = periodSettings(settings);
  const options = source ? { mode: control.mode, cutoff: edition?.post === entry.id ? editionCutoff(edition.generatedAt) : source.cutoff } : null;
  const pager = calendar && options ? matchupPager(current.week, calendar, options) : null;
  const limits = calendar && options ? customRangeLimits(calendar, options) : null;
  const customReason = current.period !== PERIOD_CUSTOM ? null : calendar && options ? resolvePeriodWindow(current, calendar, { ...control, ...options }).reason ?? null : customRangeReason(current);
  const go = (side: "prior" | "next") => {
    const target = pager?.[side];
    if (!target || !calendar || !options) return;
    // The button is about to disable at the end of the calendar, so keep the keyboard on the pager.
    if (!matchupPager(target.week, calendar, options)[side]) (side === "prior" ? nextButton : priorButton).current?.focus();
    apply({ week: target.week });
  };

  return <div className={styles.period} data-testid="period-control">
    <label>{period.label}
      <select value={current.period} disabled={disabled} onChange={event => event.target.value === PERIOD_CUSTOM ? change(period, event.target.value) : apply({ period: event.target.value })}>
        {period.kind === "select" && period.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {current.period === matchupValue && <div className={styles.pagerBlock}>
      <div className={styles.pager} role="group" aria-label="Matchup week">
        <button type="button" ref={priorButton} aria-label={pager?.prior ? `Prior week, week ${pager.prior.week}` : "Prior week"} disabled={disabled || !pager?.prior} onClick={() => go("prior")}>◀</button>
        <span className={styles.pagerLabel} data-testid="period-pager-label" aria-live="polite">{pager?.label ?? (source === undefined ? "Loading weeks…" : "Weeks unavailable")}</span>
        <button type="button" ref={nextButton} aria-label={pager?.next ? `Next week, week ${pager.next.week}` : "Next week"} disabled={disabled || !pager?.next} onClick={() => go("next")}>▶</button>
      </div>
      {source === null && <p role="alert" className={styles.defaultNote}>Matchup weeks could not be read. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry weeks</button></p>}
      {source && refreshFailed && <p role="alert" className={styles.defaultNote} data-testid="period-refresh-failed">Matchup weeks could not be refreshed, so these are from the last read. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry weeks</button></p>}
      {calendar?.reasons.map(reason => <p key={reason} className={styles.defaultNote} data-testid="period-skipped">{reason}</p>)}
    </div>}
    {current.period === PERIOD_CUSTOM && <>
      {["start", "end"].map(id => <label key={id}>{field(id).label}
        <input type="date" min={limits?.min} max={limits?.max} value={(settings[id] as string | null) ?? ""} disabled={disabled} onChange={event => change(field(id), event.target.value)} />
      </label>)}
      {customReason && <p className={styles.defaultNote} data-testid="period-reason">{customReason}</p>}
    </>}
  </div>;
}
