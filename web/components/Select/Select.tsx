// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\Select\Select.tsx

import React, { useState } from "react";
import Image from "next/legacy/image";
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
        <div className={styles.label}>{currentLabel}</div>
        <div
          className={classNames(styles.arrow, {
            [styles.up]: showOptions,
          })}
        >
          <Image
            alt="arrow"
            src="/pictures/arrow.svg"
            layout="fixed"
            width={12}
            height={6.7}
          />
        </div>
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
