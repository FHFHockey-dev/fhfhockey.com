import React, { useState } from "react";
import Image from "next/image";
import classNames from "classnames";

import { OptionsProps } from "components/Options/Options";
import styles from "./Select.module.scss";

function Select<T extends string>({
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  const [showOptions, setShowOptions] = useState(false);
  const currentLabel = options.find((op) => op.value === option)?.label;

  return (
    <div className={classNames(styles.selectWrapper, className)}>
      <div
        className={styles.select}
        onClick={() => setShowOptions((prev) => !prev)}
      >
        {currentLabel}
        <Image
          className={classNames(styles.arrow, {
            [styles.up]: showOptions,
          })}
          alt="arrow"
          src="/pictures/arrow.svg"
          layout="fixed"
          width={12}
          height={6.7}
        />
      </div>
      {showOptions && (
        <div className={styles.options}>
          {options.map((op) => (
            <div
              className={classNames({ [styles.selected]: op.value === option })}
              key={op.value}
              onClick={() => {
                setShowOptions(false);
                onOptionChange(op.value);
              }}
            >
              {op.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Select;
