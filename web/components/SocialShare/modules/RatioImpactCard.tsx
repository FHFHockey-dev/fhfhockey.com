import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { baseLabel, formatGaaChange, formatRatioGaa, formatRatioSavePct, formatSavePctChange, formatToi, RATIO_LEGEND, ratioSentence, type RatioImpactData, type RatioImpactSettings, type RatioSensitivityRow, type RatioTotals } from "lib/socialShare/modules/ratioImpact";
import { PostEmpty } from "./kit";
import styles from "./RatioImpactCard.module.scss";

/* html-to-image does not carry class styles onto SVG children, so the marks set their colours as attributes. */
const LINE = "#63D2F5", MARK = "#ffffff", MUTED = "#a9b4bd";
const CHART_WIDTH = 1006, CHART_HEIGHT = 340, LABEL_WIDTH = 110, LANE_HEIGHT = 134, LANE_ROOM = 26, LANE_FOOT = 10;

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

type Lane = { id: string; label: string; top: number; value: (row: RatioSensitivityRow) => number | null; before: number | null; format: (value: number | null) => string };
/** One goal count per column, with SV% and GAA each on its own scale in its own lane. Lines join consecutive known values only: a zero or missing denominator is a gap, never 0. */
function WhatIfChart({ rows, entered, lanes }: { rows: readonly RatioSensitivityRow[]; entered: number | null; lanes: readonly Lane[] }) {
  const step = (CHART_WIDTH - LABEL_WIDTH) / rows.length, x = (index: number) => LABEL_WIDTH + (index + 0.5) * step, enteredAt = rows.findIndex(row => row.goals === entered);
  return <svg className={styles.chart} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" data-chart="whatIf"
    aria-label={`Hypothetical SV% and GAA after the start, by goals allowed: ${rows.map(row => `${row.goals}: SV% ${formatRatioSavePct(row.after.savePct)}, GAA ${formatRatioGaa(row.after.gaa)}`).join("; ")}`}>
    {enteredAt >= 0 && <>
      <rect x={(LABEL_WIDTH + enteredAt * step).toFixed(1)} y="0" width={step.toFixed(1)} height={CHART_HEIGHT} fill={MARK} fillOpacity="0.09" data-entered-band="" />
      <text x={x(enteredAt).toFixed(1)} y="15" textAnchor="middle" fontSize="13" fontWeight="700" fill={MARK}>ENTERED</text>
    </>}
    {lanes.map(lane => {
      const known = [...rows.map(lane.value), lane.before].filter((entry): entry is number => entry !== null), low = Math.min(...known), high = Math.max(...known), bottom = lane.top + LANE_HEIGHT - LANE_FOOT;
      const y = (entry: number) => high === low ? lane.top + LANE_ROOM + (LANE_HEIGHT - LANE_ROOM - LANE_FOOT) / 2 : bottom - (entry - low) / (high - low) * (LANE_HEIGHT - LANE_ROOM - LANE_FOOT);
      return [
        <path key="rule" d={`M0 ${lane.top + LANE_HEIGHT + 4}H${CHART_WIDTH}`} fill="none" stroke={MARK} strokeOpacity="0.14" strokeWidth="1" />,
        <text key="label" x="0" y={lane.top + LANE_HEIGHT / 2} fontSize="22" fontWeight="800" fill={LINE}>{lane.label}</text>,
        lane.before !== null && <text key="beforeLabel" x="0" y={lane.top + LANE_HEIGHT / 2 + 20} fontSize="14" fill={MUTED}>Dashed: before {lane.format(lane.before)}</text>,
        lane.before !== null && <path key="before" d={`M${LABEL_WIDTH} ${y(lane.before).toFixed(1)}H${CHART_WIDTH}`} fill="none" stroke={MARK} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="5 5" data-before-line="" data-series={lane.id} />,
        ...rows.map((row, index) => {
          const current = lane.value(row), next = rows[index + 1] ? lane.value(rows[index + 1]) : null;
          return current !== null && next !== null ? <path key={`s${row.goals}`} d={`M${x(index).toFixed(1)} ${y(current).toFixed(1)}L${x(index + 1).toFixed(1)} ${y(next).toFixed(1)}`} fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" data-segment="" data-series={lane.id} /> : null;
        }),
        ...rows.flatMap((row, index) => {
          const current = lane.value(row), marked = index === enteredAt;
          if (current === null) return [<path key={`g${row.goals}`} d={`M${(x(index) - 6).toFixed(1)} ${bottom}H${(x(index) + 6).toFixed(1)}`} fill="none" stroke={LINE} strokeOpacity="0.5" strokeWidth="2" data-gap="" data-series={lane.id} />];
          return [
            <circle key={`p${row.goals}`} cx={x(index).toFixed(1)} cy={y(current).toFixed(1)} r={marked ? 7 : 4.5} fill={marked ? MARK : LINE} data-series={lane.id} data-goals={row.goals} data-value={current} data-entered={marked ? "" : undefined} />,
            <text key={`v${row.goals}`} x={x(index).toFixed(1)} y={(y(current) - 11).toFixed(1)} textAnchor="middle" fontSize="16" fontWeight={marked ? 800 : 600} fill={MARK} data-point-label={lane.id}>{lane.format(current)}</text>,
          ];
        }),
      ];
    })}
    <text x="0" y={CHART_HEIGHT - 12} fontSize="13" fontWeight="700" fill={MUTED}>GOALS ALLOWED</text>
    {rows.map((row, index) => <text key={row.goals} x={x(index).toFixed(1)} y={CHART_HEIGHT - 10} textAnchor="middle" fontSize="18" fontWeight={index === enteredAt ? 800 : 600} fill={MARK} data-goal-label="">{row.goals}</text>)}
  </svg>;
}

export default function RatioImpactCard({ data }: SharePostCardProps<RatioImpactSettings, RatioImpactData>) {
  if (data.base.kind === "none") return <PostEmpty>Choose a base goalie by goalie id to see what one start does to the ratios</PostEmpty>;
  if (data.base.totals === null) return <PostEmpty>Goalie {data.base.goalieId} has no games this season. Choose another goalie</PostEmpty>;
  if (data.afterRates.savePct === null && data.afterRates.gaa === null) return <PostEmpty>These inputs leave both SV% and GAA unknown</PostEmpty>;
  const rows = data.sensitivity, entered = data.line.goalsAgainst, line = data.line;
  return <div className={styles.card} data-testid="ratio-impact-card">
    <p className={styles.sentence} data-testid="ratio-sentence">{ratioSentence(data)}</p>
    <p className={styles.note}>{RATIO_LEGEND} Before: {baseLabel(data.base)}.</p>
    <div className={styles.tiles}>
      <RatioMetric id="savePct" title="SV%" before={formatRatioSavePct(data.before.savePct)} change={data.savePctChange === null ? null : formatSavePctChange(data.savePctChange)} after={formatRatioSavePct(data.afterRates.savePct)} caption={saveCaption} data={data} />
      <RatioMetric id="gaa" title="GAA" before={formatRatioGaa(data.before.gaa)} change={data.gaaChange === null ? null : formatGaaChange(data.gaaChange)} after={formatRatioGaa(data.afterRates.gaa)} caption={gaaCaption} data={data} />
    </div>
    <section className={styles.whatIf}>
      <h3 className={styles.title}>Hypothetical: SV% and GAA after that start, by goals allowed on {line.shotsAgainst} shots in {formatToi(line.toiSeconds)}{rows.length && !rows.some(entry => entry.goals === entered) ? <small> Entered {entered} goals is outside this range</small> : null}</h3>
      {rows.length ? <WhatIfChart rows={rows} entered={entered} lanes={[
        { id: "savePct", label: "SV%", top: 22, value: entry => entry.after.savePct, before: data.before.savePct, format: formatRatioSavePct },
        { id: "gaa", label: "GAA", top: 166, value: entry => entry.after.gaa, before: data.before.gaa, format: formatRatioGaa },
      ]} /> : <p className={styles.note}>No goal count in this range fits the entered shots</p>}
    </section>
  </div>;
}
