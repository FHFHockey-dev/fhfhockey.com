import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { baseLabel, formatGaaChange, formatRatioGaa, formatRatioSavePct, formatSavePctChange, formatToi, RATIO_NOTE, type RatioImpactData, type RatioImpactSettings, type RatioRates, type RatioSensitivityRow, type RatioTotals } from "lib/socialShare/modules/ratioImpact";
import { PostEmpty, PostTable, type PostColumn } from "./kit";
import styles from "./RatioImpactCard.module.scss";

type Line = { id: string; label: string; totals: RatioTotals | null; rates: RatioRates };

export default function RatioImpactCard({ data }: SharePostCardProps<RatioImpactSettings, RatioImpactData>) {
  if (data.afterRates.savePct === null && data.afterRates.gaa === null) return <PostEmpty>These inputs leave both SV% and GAA unknown</PostEmpty>;
  const lines: Line[] = [
    { id: "before", label: `Before: ${baseLabel(data.base)}`, totals: data.base.totals, rates: data.before },
    { id: "line", label: "Hypothetical line", totals: data.line, rates: data.lineRates },
    { id: "after", label: "After, pooled", totals: data.after, rates: data.afterRates },
  ];
  const lineColumns: PostColumn<Line>[] = [
    { id: "label", label: "TOTALS", cell: line => line.label },
    { id: "saves", label: "SV", numeric: true, cell: line => line.totals?.saves ?? "—" },
    { id: "sa", label: "SA", numeric: true, cell: line => line.totals?.shotsAgainst ?? "—" },
    { id: "savePct", label: "SV%", numeric: true, cell: line => <b>{formatRatioSavePct(line.rates.savePct)}</b> },
    { id: "ga", label: "GA", numeric: true, cell: line => line.totals?.goalsAgainst ?? "—" },
    { id: "toi", label: "TOI (M:SS)", numeric: true, cell: line => formatToi(line.totals?.toiSeconds ?? null) },
    { id: "gaa", label: "GAA", numeric: true, cell: line => <b>{formatRatioGaa(line.rates.gaa)}</b> },
  ];
  const sensitivityColumns: PostColumn<RatioSensitivityRow>[] = [
    { id: "goals", label: "HYPOTHETICAL GA", numeric: true, cell: row => row.goals },
    { id: "saves", label: "SV", numeric: true, cell: row => row.saves },
    { id: "savePct", label: "SV% AFTER", numeric: true, cell: row => formatRatioSavePct(row.after.savePct) },
    { id: "savePctChange", label: "CHANGE", numeric: true, cell: row => formatSavePctChange(row.savePctChange) },
    { id: "gaa", label: "GAA AFTER", numeric: true, cell: row => formatRatioGaa(row.after.gaa) },
    { id: "gaaChange", label: "CHANGE", numeric: true, cell: row => formatGaaChange(row.gaaChange) },
  ];
  return <div className={styles.card} data-testid="ratio-impact-card">
    <PostTable columns={lineColumns} rows={lines} rowKey={line => line.id} />
    <p className={styles.change}>SV% {formatSavePctChange(data.savePctChange)} · GAA {formatGaaChange(data.gaaChange)}</p>
    <section>
      <h3 className={styles.title}>Sensitivity at {data.line.shotsAgainst} SA and {formatToi(data.line.toiSeconds)} TOI</h3>
      <PostTable columns={sensitivityColumns} rows={data.sensitivity} rowKey={row => row.goals} />
    </section>
    <p className={styles.note}>{RATIO_NOTE} SV% = saves ÷ SA. GAA = GA × 3600 ÷ TOI seconds. A zero or missing denominator shows —.</p>
  </div>;
}
