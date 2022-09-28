import styles from "./Switch.module.css";

type SwitchProps = {
  onClick?: () => void;
  checked?: boolean;
  disabled?: boolean;
  [x: string]: any;
};

function Switch({
  checked = false,
  disabled = false,
  onClick,
  ...rest
}: SwitchProps) {
  return (
    <div
      className={`${styles[!checked ? "arrow-up" : "arrow-down"]} ${
        disabled ? styles.disabled : ""
      }`}
      onClick={onClick}
      {...rest}
    />
  );
}

export default Switch;
