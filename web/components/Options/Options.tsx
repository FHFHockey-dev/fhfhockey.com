import React from "react";
import classNames from "classnames";

import styles from "./Options.module.scss";

export type OptionsProps<T> = {
  ariaLabel?: string;
  className?: string;
  type?: "row" | "column";
  options: readonly { label: string; value: T }[];
  option: T;
  onOptionChange: (newOption: T) => void;
};

function Options<T extends string>({
  ariaLabel = "Options",
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      className={classNames(styles.options, className)}
      role="group"
    >
      {options.map((op) => (
        <button
          type="button"
          key={op.value}
          aria-pressed={option === op.value}
          className={classNames(styles.button, {
            [styles.checked]: option === op.value,
          })}
          onClick={() => onOptionChange(op.value)}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}

export default Options;
