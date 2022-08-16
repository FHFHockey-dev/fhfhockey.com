import classNames from "classnames";
import React from "react";

import styles from "./CheckButton.module.scss";

type CheckButtonProps = {
  children: React.ReactNode;
  checked?: boolean;
  onClick?: () => void;
};

function CheckButton({ children, checked, onClick }: CheckButtonProps) {
  return (
    <div className={styles.checkButtonWrapper}>
      <button
        className={classNames(styles.checkButton, {
          [styles.checked]: checked,
        })}
        type="button"
        onClick={onClick}
      >
        {children}
      </button>
    </div>
  );
}

export default CheckButton;
