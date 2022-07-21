import Image from "next/image";
import { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

import styles from "./IconButton.module.scss";

type IconButtonProps =
  | {
      icon: "share" | "heart-filled" | "heart-outlined";
      size?: "small" | "large";
    } & DetailedHTMLProps<
      ButtonHTMLAttributes<HTMLButtonElement>,
      HTMLButtonElement
    >;

const ICON_MAP: Map<IconButtonProps["icon"], string> = new Map([
  ["share", "/pictures/share-button.svg"],
  ["heart-filled", "/pictures/heart-filled.png"],
  ["heart-outlined", "/pictures/heart-outlined.svg"],
]);

const SIZE_MAP = {
  small: 28,
  large: 32,
};

function IconButton({ icon, size = "small", ...props }: IconButtonProps) {
  const iconSrc = ICON_MAP.get(icon) as string;

  return (
    <button className={styles.iconButton} type="button" {...props}>
      <Image
        src={iconSrc}
        alt="share button"
        width={SIZE_MAP[size]}
        height={SIZE_MAP[size]}
      />
    </button>
  );
}

export default IconButton;
