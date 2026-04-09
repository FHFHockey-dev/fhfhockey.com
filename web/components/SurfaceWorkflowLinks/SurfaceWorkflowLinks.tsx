import Link from "next/link";

import type { SiteSurfaceLink } from "lib/navigation/siteSurfaceLinks";
import styles from "./SurfaceWorkflowLinks.module.scss";

type SurfaceWorkflowLinksProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  links: SiteSurfaceLink[];
  className?: string;
};

export default function SurfaceWorkflowLinks({
  eyebrow = "Workflow",
  title,
  description,
  links,
  className
}: SurfaceWorkflowLinksProps) {
  if (!links.length) return null;

  return (
    <section className={[styles.wrapper, className].filter(Boolean).join(" ")}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>

      <div className={styles.grid}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.linkCard}>
            <span className={styles.label}>{link.label}</span>
            <span className={styles.copy}>{link.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
