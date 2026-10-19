import styles from "./RosterScheduleOptimizer.module.scss";

type Props = {
  readOnly: boolean;
  setTiming: (timing: "same_day" | "next_day") => void;
};

/** Shown by "Optimize lineup" only when Yahoo leaves add timing unknown; without it no add can be suggested. */
export default function OptimizeLineup({ readOnly, setTiming }: Props) {
  return <p className={styles.timingPrompt} role="group" aria-label="Acquisition timing">
    To suggest adds, choose when an add counts in your league:
    <button disabled={readOnly} onClick={() => setTiming("same_day")}>Same day</button>
    <button disabled={readOnly} onClick={() => setTiming("next_day")}>Next day</button>
  </p>;
}
