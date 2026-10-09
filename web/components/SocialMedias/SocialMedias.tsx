import React from "react";
import Image from "next/image";

import styles from "./SocialMedias.module.scss";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import classNames from "classnames";

function SocialMedias({ className, labeled = false }: { className?: string; labeled?: boolean }) {
  const size = useScreenSize();
  const imgSize = size.screen === BreakPoint.l ? 32 : 48;
  return (
    <ClientOnly className={classNames(styles.socialMedias, className, { [styles.labeled]: labeled })}>
      <a
        href="https://www.twitter.com/fhfhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/twitter.png"
          alt={labeled ? "" : "Twitter"}
          width={imgSize}
          height={imgSize}
          priority
        />
        {labeled && <span>Twitter</span>}
      </a>
      <a
        href="https://discord.gg/kfnyrn7"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/discord.png"
          alt={labeled ? "" : "Discord"}
          width={imgSize}
          height={imgSize}
          priority
        />
        {labeled && <span>Discord</span>}
      </a>
      <a
        href="https://www.patreon.com/FHFHRadio"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/patreon.png"
          alt={labeled ? "" : "Patreon"}
          width={imgSize}
          height={imgSize}
          priority
        />
        {labeled && <span>Patreon</span>}
      </a>
      <a
        href="https://www.youtube.com/fiveholefantasyhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/youtube.png"
          alt={labeled ? "" : "Youtube"}
          width={imgSize}
          height={imgSize}
          priority
        />
        {labeled && <span>YouTube</span>}
      </a>
      <a
        href="https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/spotify.png"
          alt={labeled ? "" : "Spotify"}
          width={imgSize}
          height={imgSize}
          priority
        />
        {labeled && <span>Spotify</span>}
      </a>
    </ClientOnly>
  );
}

export default SocialMedias;
