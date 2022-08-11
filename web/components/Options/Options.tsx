import React, { Dispatch, SetStateAction } from "react";
import classNames from "classnames";
import CheckButton from "components/CheckButton";

import styles from "./Options.module.scss";

export type OptionsProps<T> = {
  className?: string;
  options: readonly { label: string; value: T }[];
  option: T;
  onOptionChange: Dispatch<SetStateAction<T>>;
};

function Options<T extends string>({
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={classNames(styles.options, className)}>
      {options.map((op) => (
        <CheckButton
          key={op.value}
          checked={option === op.value}
          onClick={() => onOptionChange(op.value)}
        >
          {op.label}
        </CheckButton>
      ))}
    </div>
  );
}

export default Options;
