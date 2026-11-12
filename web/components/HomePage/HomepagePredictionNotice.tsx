import styles from "./HomepagePredictionNotice.module.scss";

/** Decision 42: say plainly when FHFH has no qualified game prediction. */
export default function HomepagePredictionNotice({
  notice,
}: {
  notice: string | null;
}) {
  if (!notice) return null;
  return (
    <p className={styles.notice} role="note" data-prediction-notice="true">
      {notice}
    </p>
  );
}
