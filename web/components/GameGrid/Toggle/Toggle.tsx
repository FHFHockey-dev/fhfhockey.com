// components/GameGrid/Toggle.tsx
import React from "react";
import styles from "./Toggle.module.css"; // Ensure you have a CSS file for the toggle

type ToggleProps = {
  checked: boolean;
  onChange: () => void;
};

export default function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={`${styles.slider} ${styles.round}`}></span>
    </label>
  );
}
