import classNames from "classnames";
import styles from "./Spinner.module.scss";

type SpinnerProps = {
  className?: string;
  center?: boolean;
};

function Spinner({ className, center, ...props }: SpinnerProps) {
  return (
    <div
      className={classNames(styles.spinnerContainer, className, {
        [styles.center]: center,
      })}
      {...props}
    >
      <div className={styles.loadingSpinner}></div>
    </div>
  );
}

export default Spinner;
