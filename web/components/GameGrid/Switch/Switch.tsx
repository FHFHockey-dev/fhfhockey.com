import React from "react";
import styles from "./Switch.module.scss";

type SwitchProps = {
  onClick?: () => void;
  checked?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  [x: string]: any;
};

function Switch({
  checked = false,
  disabled = false,
  onClick,
  "aria-label": ariaLabel,
  className,
  ...rest
}: SwitchProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!disabled && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled && onClick) {
        onClick();
      }
    }
  };

  return (
    <button
      type="button"
      className={`${styles.switch} ${checked ? styles.checked : styles.unchecked} ${
        disabled ? styles.disabled : ""
      } ${className || ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel || `Toggle ${checked ? "on" : "off"}`}
      aria-pressed={checked}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      {...rest}
    >
      <span className={styles.arrow} />
    </button>
  );
}

export default Switch;
