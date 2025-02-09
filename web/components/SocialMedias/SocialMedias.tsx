import React from "react";
import Image from "next/legacy/image";

import styles from "./SocialMedias.module.scss";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";

function SocialMedias() {
  const size = useScreenSize();
  const imgSize = size.screen === BreakPoint.l ? 32 : 48;
  return (
    <ClientOnly className={styles.socialMedias}>
      <a
        href="https://www.twitter.com/fhfhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/twitter.png"
          alt="Twitter"
          width={imgSize}
          height={imgSize}
          priority
        />
      </a>
      <a
        href="https://discord.gg/kfnyrn7"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/discord.png"
          alt="Discord"
          width={imgSize}
          height={imgSize}
          priority
        />
      </a>
      <a
        href="https://www.patreon.com/FHFHRadio"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/patreon.png"
          alt="Patreon"
          width={imgSize}
          height={imgSize}
          priority
        />
      </a>
      <a
        href="https://www.youtube.com/fiveholefantasyhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/youtube.png"
          alt="Youtube"
          width={imgSize}
          height={imgSize}
          priority
        />
      </a>
      <a
        href="https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/spotify.png"
          alt="Spotify"
          width={imgSize}
          height={imgSize}
          priority
        />
      </a>
    </ClientOnly>
  );
}

export default SocialMedias;
