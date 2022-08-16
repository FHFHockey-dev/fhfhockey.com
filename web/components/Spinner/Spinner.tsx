import classNames from "classnames";
import styles from "./Spinner.module.scss";

type SpinnerProps = {
  className?: string;
  center?: boolean;
  size?: "small" | "medium";
};

function Spinner({
  className,
  center,
  size = "medium",
  ...props
}: SpinnerProps) {
  return (
    <div
      className={classNames(styles.spinnerContainer, className, {
        [styles.center]: center,
      })}
      {...props}
    >
      <div
        className={classNames(styles.loadingSpinner, {
          [styles.small]: size === "small",
          [styles.medium]: size === "medium",
        })}
      ></div>
    </div>
  );
}

export default Spinner;
