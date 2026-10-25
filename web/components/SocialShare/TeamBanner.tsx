/* eslint-disable @next/next/no-img-element -- Owned logos are decoded and embedded by html-to-image for exact PNG exports. */
import type { CSSProperties, ReactNode } from "react";
import { teamsInfo } from "lib/teamsInfo";
import type { ShareTeam } from "lib/socialShare/types";
import styles from "./SocialShare.module.scss";

const luminance = (hex: string) => {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!value) return 0.5;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Sporty team stripes from lib/teamsInfo colors: a primary-color band (secondary when the primary is
 * near-black) over dark / light / secondary / dark stripes, with text chosen for contrast.
 */
export function teamBannerStyle(abbreviation: string): CSSProperties {
  const info = (teamsInfo as Record<string, { primaryColor: string; secondaryColor: string; jersey: string; accent: string; alt: string } | undefined>)[abbreviation];
  if (!info) return { "--team-bg": "#2a2f36", "--team-ink": "#ffffff", "--team-dark": "#0b0d10", "--team-light": "#d8dde3", "--team-mid": "#5b6470" } as CSSProperties;
  const bg = luminance(info.primaryColor) < 0.03 ? info.secondaryColor : info.primaryColor;
  const palette = [info.primaryColor, info.secondaryColor, info.jersey, info.accent, info.alt];
  const dark = [...palette, "#0b0d10"].sort((a, b) => luminance(a) - luminance(b))[0];
  const light = [...palette, "#ffffff"].sort((a, b) => luminance(b) - luminance(a))[0];
  const mid = [info.secondaryColor, info.accent, info.alt, info.primaryColor].find(color => !sameColor(color, bg) && !sameColor(color, dark) && !sameColor(color, light)) ?? light;
  return { "--team-bg": bg, "--team-ink": luminance(bg) > 0.4 ? "#101317" : "#ffffff", "--team-dark": dark, "--team-light": light, "--team-mid": mid } as CSSProperties;
}

export function TeamLogo({ team, logo, size }: { team: Pick<ShareTeam, "abbreviation">; logo: string | null | undefined; size: number }) {
  return logo ? <img src={logo} alt="" width={size} height={size} /> : <b className={styles.logoFallback}>{team.abbreviation}</b>;
}

/** Team banner header: logo on the left over the stripes, a title and subtitle, and an optional right slot. */
export function TeamBanner({ team, logo, title, subtitle, right, size = "md" }: { team: Pick<ShareTeam, "abbreviation">; logo: string | null | undefined; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; size?: "sm" | "md" }) {
  return <div className={styles.teamBanner} data-size={size} style={teamBannerStyle(team.abbreviation)}>
    <span className={styles.teamBannerLogo}><TeamLogo team={team} logo={logo} size={size === "sm" ? 40 : 52} /></span>
    <span className={styles.teamBannerText}><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
    {right && <span className={styles.teamBannerRight}>{right}</span>}
  </div>;
}
