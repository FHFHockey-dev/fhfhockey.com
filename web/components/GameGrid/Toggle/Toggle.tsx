import styles from "./Toggle.module.css";

type ToggleProps = {
  checked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
};
function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={`${styles.slider} ${styles.round}`}></span>
    </label>
  );
}

export default Toggle;
