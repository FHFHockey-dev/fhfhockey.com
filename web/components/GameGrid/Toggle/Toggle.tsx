// components/GameGrid/Toggle.tsx
import React from "react";
import styles from "./Toggle.module.scss";

type ToggleProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
  size?: "small" | "medium" | "large";
};

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
  className,
  size = "medium",
}: ToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      if (!disabled) {
        onChange();
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled) {
      onChange();
    }
  };

  return (
    <label className={`${styles.switch} ${styles[size]} ${className || ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />
      <span
        className={`${styles.slider} ${styles.round}`}
        role="switch"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      />
    </label>
  );
}
