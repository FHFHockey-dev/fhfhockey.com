import { categoryBlueprintCurrent, STALE_SETTINGS_NOTE, type CategoryBlueprintData, type CategoryBlueprintSettings, type CategoryRow } from "lib/socialShare/modules/categoryBlueprint";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { SkaterBoard, SkaterCell, skaterLogoSize, windowShort } from "./BshBoardCard";
import { PostEmpty, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

export default function CategoryBlueprintCard({ data, settings, logos }: SharePostCardProps<CategoryBlueprintSettings, CategoryBlueprintData>) {
  if (!categoryBlueprintCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const size = skaterLogoSize(data.rows.length);
  const columns: PostColumn<CategoryRow>[] = [
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} size={size} /> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.games },
    ...data.categories.map((category, index): PostColumn<CategoryRow> => ({
      id: category.id, label: `${category.label}/G`, numeric: true,
      cell: row => { const cell = row.cells[index]; return cell.perGame === null ? <span className={styles.missing}>missing</span> : <span className={styles.pair}>{cell.perGame.toFixed(2)} <small>#{cell.rank}</small></span>; },
    })),
  ];
  const legend = `Per game, ${windowShort(settings.window)}. # is category rank among ${data.cohortSize}. Top ${data.topIn} in each; no combined score.`;
  return <SkaterBoard legend={legend} columns={columns} rows={data.rows} rowKey={row => row.playerId} empty={data.rows.length ? null : `No skater is in the top ${data.topIn} of every chosen category`} />;
}
