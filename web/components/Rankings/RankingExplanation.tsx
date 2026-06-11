import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "lib/rankings/rankingTypes";
import { buildRankingExplanationItems } from "lib/rankings/rankingFormatters";

import styles from "styles/Rankings.module.scss";

type RankingExplanationProps = {
  row: ContextualRankingApiRow;
  request: ContextualRankingsRequest;
};

export default function RankingExplanation({
  row,
  request,
}: RankingExplanationProps) {
  const items = buildRankingExplanationItems({ row, request });

  return (
    <div className={styles.explanation}>
      <dl>
        <div>
          <dt>Metric</dt>
          <dd>{row.metric.formattedValue ?? "-"}</dd>
        </div>
        <div>
          <dt>Sample</dt>
          <dd>
            {row.sample.gamesPlayed ?? "-"} GP,{" "}
            {row.sample.minimumSampleMet ? "qualified" : "below minimum"}
          </dd>
        </div>
      </dl>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
