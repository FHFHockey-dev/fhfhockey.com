// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\Spinner\Spinner.tsx

import classNames from "classnames";
import styles from "./Spinner.module.scss";

type SpinnerProps = {
  className?: string;
  center?: boolean;
  size?: "small" | "medium";
  /** Announced loading text, for callers that have no other loading status. */
  label?: string;
};

function Spinner({
  className,
  center,
  size = "medium",
  label,
  ...props
}: SpinnerProps) {
  return (
    <div
      className={classNames(styles.spinnerContainer, className, {
        [styles.center]: center,
      })}
      role={label ? "status" : undefined}
      {...props}
    >
      <div
        className={classNames(styles.loadingSpinner, {
          [styles.small]: size === "small",
          [styles.medium]: size === "medium",
        })}
        aria-hidden="true"
      ></div>
      {label ? <span className={styles.visuallyHidden}>{label}</span> : null}
    </div>
  );
}

export default Spinner;
