import { CATEGORY_PERCENTILE_BANDS, categoryBlueprintCurrent, categoryPercentileBand, MULTI_CAT_FORMULA, STALE_SETTINGS_NOTE, type CategoryBlueprintData, type CategoryBlueprintSettings, type CategoryPercentileBand, type CategoryRow } from "lib/socialShare/modules/categoryBlueprint";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { SkaterBoard, SkaterCell, skaterLogoSize, windowShort } from "./BshBoardCard";
import { PostEmpty, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

/** Colours are inline so the PNG capture keeps them. */
export const BAND_FILL: Record<CategoryPercentileBand, string> = { p95: "rgba(0, 255, 153, 0.8)", p85: "rgba(0, 255, 153, 0.42)", p70: "rgba(0, 255, 153, 0.22)", p50: "rgba(255, 255, 255, 0.08)", lower: "rgba(255, 99, 132, 0.42)" };
export const bandText = (band: CategoryPercentileBand) => band === "p95" ? "#0b0f12" : "#ffffff";
/** Laid over the chip, so the percentile square is a darker shade of whichever colour its chip is. */
export const SQUARE_SHADE = "rgba(0, 0, 0, 0.22)";

export default function CategoryBlueprintCard({ data, settings, logos }: SharePostCardProps<CategoryBlueprintSettings, CategoryBlueprintData>) {
  if (!categoryBlueprintCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const size = skaterLogoSize(data.rows.length);
  const columns: PostColumn<CategoryRow>[] = [
    { id: "rank", label: "RK", numeric: true, cell: row => row.rank },
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.games },
    ...data.categories.map((category, index): PostColumn<CategoryRow> => ({
      id: category.id, label: `${category.label}/G`, numeric: true,
      cell: row => {
        const cell = row.cells[index], band = categoryPercentileBand(cell.percentile);
        if (cell.perGame === null || cell.percentile === null || band === null) return <span className={styles.bandMissing} data-testid="rank-cell" data-band="missing">missing</span>;
        return <span className={styles.band} data-testid="rank-cell" data-band={band} style={{ backgroundColor: BAND_FILL[band], color: bandText(band) }}><span>{cell.perGame.toFixed(2)}</span> <small className={styles.bandSquare} data-testid="rank-percentile" style={{ backgroundColor: SQUARE_SHADE, color: bandText(band) }}>P{Math.round(cell.percentile)}</small></span>;
      },
    })),
    { id: "score", label: "SCORE", numeric: true, cell: row => <b className={styles.score} data-testid="multi-cat-score" style={{ color: "#ffffff" }}>{row.score.toFixed(1)}</b> },
  ];
  const legend = <>{windowShort(settings.window)} per game. Square = percentile of {data.cohortSize}: others beaten, ties half. <span className={styles.bandKey}>{CATEGORY_PERCENTILE_BANDS.map(band => <span key={band.id}><i style={{ backgroundColor: BAND_FILL[band.id] }} />{band.label}</span>)}</span> SCORE = {MULTI_CAT_FORMULA[data.view]}.</>;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.length ? null : "No skater has all four categories with these settings"} compact />;
}
