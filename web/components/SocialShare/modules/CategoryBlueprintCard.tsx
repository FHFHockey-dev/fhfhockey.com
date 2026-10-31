import { categoryBlueprintCurrent, STALE_SETTINGS_NOTE, type CategoryBlueprintData, type CategoryBlueprintSettings, type CategoryRow } from "lib/socialShare/modules/categoryBlueprint";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { SkaterCell } from "./BshBoardCard";
import { PostEmpty, PostTable, type PostColumn } from "./kit";
import styles from "./BshBoardCard.module.scss";

export default function CategoryBlueprintCard({ data, settings, logos }: SharePostCardProps<CategoryBlueprintSettings, CategoryBlueprintData>) {
  if (!categoryBlueprintCurrent(data, settings)) return <PostEmpty>{STALE_SETTINGS_NOTE}</PostEmpty>;
  const columns: PostColumn<CategoryRow>[] = [
    { id: "player", label: "SKATER", cell: row => <SkaterCell row={row} logo={row.team ? logos[row.team] : null} /> },
    { id: "gp", label: "GP", numeric: true, cell: row => row.games },
    ...data.categories.map((category, index): PostColumn<CategoryRow> => ({
      id: category.id, label: `${category.label}/G`, numeric: true,
      cell: row => { const cell = row.cells[index]; return cell.perGame === null ? <span className={styles.missing}>missing</span> : <span className={styles.pair}>{cell.perGame.toFixed(2)} <small>#{cell.rank}</small></span>; },
    })),
  ];
  const lead = <p className={styles.lead}>Per game over each skater&apos;s <b>{data.windowLabel}</b>, with each category&apos;s own rank among <b>{data.cohortSize}</b> skaters. Shown: top {data.topIn} in every category, ordered by {data.categories[0].name.toLowerCase()}. Categories stay separate: no combined score.</p>;
  const missing = data.categories.filter(category => category.missing).map(category => `${category.name}: ${category.missing} skaters missing`);
  const notes = [...missing, data.notShown ? `${data.notShown} more qualify below` : ""].filter(Boolean).join(" · ");
  if (!data.rows.length) return <div className={styles.board}>{lead}<PostEmpty>No skater is in the top {data.topIn} of every chosen category</PostEmpty>{notes && <p className={styles.note}>{notes}</p>}</div>;
  return <div className={styles.board}>
    {lead}
    <PostTable columns={columns} rows={data.rows} rowKey={row => row.playerId} />
    {notes && <p className={styles.note}>{notes}</p>}
  </div>;
}
