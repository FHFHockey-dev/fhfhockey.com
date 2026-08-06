import Head from "next/head";
import Link from "next/link";

import styles from "./LegacySurfaceNotice.module.scss";

type Props = {
  children: React.ReactNode;
  replacementHref: string;
  replacementLabel: string;
};

export default function LegacySurfaceNotice({
  children,
  replacementHref,
  replacementLabel,
}: Props) {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <aside className={styles.notice} role="note">
        <strong>Legacy analysis surface</strong>
        <p>{children}</p>
        <Link href={replacementHref}>Use {replacementLabel}</Link>
      </aside>
    </>
  );
}
