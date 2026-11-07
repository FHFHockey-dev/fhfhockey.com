import styles from "./RatingMeter.module.scss";

type RatingKind = "atk" | "def";

const RATING_TITLE: Record<RatingKind, string> = {
  atk: "Opponents' attack",
  def: "Opponents' defense",
};
const RATING_SOURCE: Record<RatingKind, string> = {
  atk: "expected goals for per game",
  def: "expected goals against per game; fewer ranks higher",
};

function ordinal(value: number) {
  const mod100 = value % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${suffix}`;
}

/** Opponent-rating percentile with a slim neon meter; colour marks the side, not good/bad. */
export default function RatingMeter({ kind, value, average }: { kind: RatingKind; value: number | null; average?: number | null }) {
  const rounded = value == null ? null : Math.round(value);
  const title = rounded == null
    ? `${RATING_TITLE[kind]} · unavailable`
    : `${RATING_TITLE[kind]} · ${ordinal(rounded)} percentile (${RATING_SOURCE[kind]})`;
  return (
    <span className={styles.meter} data-kind={kind} title={title}>
      <span className={styles.value}>{rounded ?? "-"}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.rail}>
          {rounded != null && <span className={styles.fill} style={{ width: `${Math.max(4, rounded)}%` }} />}
        </span>
        {average != null && <span className={styles.averageTick} style={{ left: `${average}%` }} />}
      </span>
    </span>
  );
}
