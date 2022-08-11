import classNames from "classnames";
import React from "react";
import styles from "./BurgerButton.module.scss";

function BurgerButton({
  className,
  onClick,
}: React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>) {
  return (
    <button
      type="button"
      className={classNames(styles.button, className)}
      onClick={onClick}
    >
      <div />
      <div />
      <div />
    </button>
  );
}

export default BurgerButton;
