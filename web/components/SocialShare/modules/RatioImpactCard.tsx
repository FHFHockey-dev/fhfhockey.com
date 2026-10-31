import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { baseLabel, formatGaaChange, formatRatioGaa, formatRatioSavePct, formatSavePctChange, formatToi, RATIO_LEGEND, type RatioImpactData, type RatioImpactSettings, type RatioSensitivityRow, type RatioTotals } from "lib/socialShare/modules/ratioImpact";
import { PostEmpty } from "./kit";
import styles from "./RatioImpactCard.module.scss";

/* html-to-image does not carry class styles onto SVG children, so the marks set their colours as attributes. */
const LINE = "#63D2F5", MARK = "#ffffff";
/** The chart spans the table's value columns, 1006px less the 126px label column, so each point sits over its printed values. */
const CHART_WIDTH = 880, CHART_HEIGHT = 170, CHART_PAD = 26;

const saveCaption = (totals: RatioTotals | null) => totals && `${totals.saves ?? "—"} SV ÷ ${totals.shotsAgainst ?? "—"} SA`;
const gaaCaption = (totals: RatioTotals | null) => totals && `${totals.goalsAgainst ?? "—"} GA in ${formatToi(totals.toiSeconds)} TOI`;

function RatioTile({ kind, label, value, caption }: { kind: "before" | "after"; label: string; value: string; caption: string | null }) {
  return <span className={styles.tile} data-tile={kind}><small>{label}</small><b>{value}</b>{caption && <small>{caption}</small>}</span>;
}
/** No change is drawn unless both sides are known. */
function RatioMetric({ id, title, before, change, after, caption, data }: { id: string; title: string; before: string; change: string | null; after: string; caption: (totals: RatioTotals | null) => string | null; data: RatioImpactData }) {
  return <section className={styles.metric} data-metric={id}>
    <h3 className={styles.metricTitle}>{title}</h3>
    <div className={styles.pair}>
      <RatioTile kind="before" label="Before" value={before} caption={caption(data.base.totals)} />
      {change !== null && <span className={styles.change}>
        <svg data-testid="ratio-arrow" width="44" height="16" viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8H41M34 2L41 8L34 14" fill="none" stroke={LINE} strokeWidth="2" /></svg>
        <b data-testid="ratio-change">{change}</b>
      </span>}
      <RatioTile kind="after" label="After, pooled" value={after} caption={caption(data.after)} />
    </div>
  </section>;
}

/** After rates across the stated goals. Lines join consecutive known values only: a zero or missing denominator is a gap, never 0. */
function SensitivityChart({ id, label, rows, value, before, entered, format }: { id: string; label: string; rows: readonly RatioSensitivityRow[]; value: (row: RatioSensitivityRow) => number | null; before: number | null; entered: number | null; format: (value: number | null) => string }) {
  const known = [...rows.map(value), before].filter((entry): entry is number => entry !== null), low = Math.min(...known), high = Math.max(...known);
  const step = CHART_WIDTH / rows.length, x = (index: number) => (index + 0.5) * step;
  const y = (entry: number) => high === low ? CHART_HEIGHT / 2 : CHART_HEIGHT - CHART_PAD - (entry - low) / (high - low) * (CHART_HEIGHT - 2 * CHART_PAD);
  const enteredAt = rows.findIndex(row => row.goals === entered);
  return <svg className={styles.chart} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" data-chart={id}
    aria-label={`${label} by hypothetical goals against: ${rows.map(row => `${row.goals}: ${format(value(row))}`).join(", ")}`}>
    {enteredAt >= 0 && <>
      <rect x={(enteredAt * step).toFixed(1)} y="0" width={step.toFixed(1)} height={CHART_HEIGHT} fill={MARK} fillOpacity="0.09" data-entered-band="" />
      <text x={x(enteredAt).toFixed(1)} y="15" textAnchor="middle" fontSize="13" fontWeight="700" fill={MARK}>ENTERED</text>
    </>}
    {before !== null && <path d={`M0 ${y(before).toFixed(1)}H${CHART_WIDTH}`} fill="none" stroke={MARK} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 5" data-before-line="" />}
    {rows.map((row, index) => {
      const current = value(row), next = rows[index + 1] ? value(rows[index + 1]) : null;
      return current !== null && next !== null ? <path key={`s${row.goals}`} d={`M${x(index).toFixed(1)} ${y(current).toFixed(1)}L${x(index + 1).toFixed(1)} ${y(next).toFixed(1)}`} fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" data-segment="" /> : null;
    })}
    {rows.map((row, index) => {
      const current = value(row), marked = index === enteredAt;
      if (current === null) return <path key={row.goals} d={`M${(x(index) - 6).toFixed(1)} ${CHART_HEIGHT - 3}H${(x(index) + 6).toFixed(1)}`} fill="none" stroke={LINE} strokeOpacity="0.5" strokeWidth="2" data-gap="" />;
      return <circle key={row.goals} cx={x(index).toFixed(1)} cy={y(current).toFixed(1)} r={marked ? 7 : 4.5} fill={marked ? MARK : LINE} data-goals={row.goals} data-value={current} data-entered={marked ? "" : undefined} />;
    })}
  </svg>;
}

export default function RatioImpactCard({ data }: SharePostCardProps<RatioImpactSettings, RatioImpactData>) {
  if (data.afterRates.savePct === null && data.afterRates.gaa === null) return <PostEmpty>These inputs leave both SV% and GAA unknown</PostEmpty>;
  const rows = data.sensitivity, entered = data.line.goalsAgainst, line = data.line;
  const row = (id: string, label: string, cell: (row: RatioSensitivityRow) => string | number) => <>
    <span className={styles.rowLabel}>{label}</span>
    {rows.map(entry => <span key={entry.goals} className={styles.value} data-row={id} data-entered={entry.goals === entered ? "" : undefined}>{cell(entry)}</span>)}
  </>;
  const chartLabel = (label: string, before: number | null, format: (value: number | null) => string) => <span className={styles.chartLabel}>{label}{before !== null && <small>Dashed: before {format(before)}</small>}</span>;
  return <div className={styles.card} data-testid="ratio-impact-card">
    <p className={styles.note}>{RATIO_LEGEND} Before: {baseLabel(data.base)}.</p>
    <div className={styles.tiles}>
      <RatioMetric id="savePct" title="SV%" before={formatRatioSavePct(data.before.savePct)} change={data.savePctChange === null ? null : formatSavePctChange(data.savePctChange)} after={formatRatioSavePct(data.afterRates.savePct)} caption={saveCaption} data={data} />
      <RatioMetric id="gaa" title="GAA" before={formatRatioGaa(data.before.gaa)} change={data.gaaChange === null ? null : formatGaaChange(data.gaaChange)} after={formatRatioGaa(data.afterRates.gaa)} caption={gaaCaption} data={data} />
    </div>
    <p className={styles.line}>Hypothetical line: {saveCaption(line)} = {formatRatioSavePct(data.lineRates.savePct)} · {gaaCaption(line)} = {formatRatioGaa(data.lineRates.gaa)}</p>
    <section className={styles.sensitivity}>
      <h3 className={styles.title}>Sensitivity at {line.shotsAgainst} SA and {formatToi(line.toiSeconds)} TOI{rows.length && !rows.some(entry => entry.goals === entered) ? <small> Entered {entered} GA is outside this range</small> : null}</h3>
      {rows.length ? <div className={styles.table} style={{ gridTemplateColumns: `126px repeat(${rows.length}, minmax(0, 1fr))` }}>
        {row("goals", "HYPOTHETICAL GA", entry => entry.goals)}
        {row("saves", "SV", entry => entry.saves)}
        {chartLabel("SV% AFTER", data.before.savePct, formatRatioSavePct)}
        <SensitivityChart id="savePct" label="SV% after" rows={rows} value={entry => entry.after.savePct} before={data.before.savePct} entered={entered} format={formatRatioSavePct} />
        {row("savePct", "SV% AFTER", entry => formatRatioSavePct(entry.after.savePct))}
        {row("savePctChange", "CHANGE", entry => formatSavePctChange(entry.savePctChange))}
        {chartLabel("GAA AFTER", data.before.gaa, formatRatioGaa)}
        <SensitivityChart id="gaa" label="GAA after" rows={rows} value={entry => entry.after.gaa} before={data.before.gaa} entered={entered} format={formatRatioGaa} />
        {row("gaa", "GAA AFTER", entry => formatRatioGaa(entry.after.gaa))}
        {row("gaaChange", "CHANGE", entry => formatGaaChange(entry.gaaChange))}
      </div> : <p className={styles.note}>No goal count in this range fits the entered shots</p>}
    </section>
  </div>;
}
