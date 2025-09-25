import styles from "../../pages/trends/index.module.scss";

type Props = {
  dateLabel: string;
  onStep: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export default function Stepper({ dateLabel, onStep, disabled, busy }: Props) {
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperLabel}>Viewing</span>
      <span className={styles.stepperDate}>{dateLabel || "—"}</span>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={onStep}
        disabled={disabled}
      >
        {busy ? "Running…" : "Step +1 day"}
      </button>
    </div>
  );
}
