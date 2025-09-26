import styles from "../../pages/trends/index.module.scss";

type Props = {
  dateLabel: string;
  onStep: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export default function Stepper({ dateLabel, onStep, disabled, busy }: Props) {
  return (
    <div className={styles.stepper} role="group" aria-label="Date navigation">
      <div className={styles.stepperInfo} aria-live="polite">
        <span className={styles.stepperLabel}>Viewing</span>
        <span className={styles.stepperDate}>{dateLabel || "—"}</span>
      </div>
      <div className={styles.stepperActions}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={onStep}
          disabled={disabled}
        >
          {busy ? "Running…" : "+1 Day"}
        </button>
      </div>
    </div>
  );
}
