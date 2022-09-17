import React from "react";
import Image from "next/image";

import styles from "./SocialMedias.module.scss";

function SocialMedias() {
  return (
    <div className={styles.socialMedias}>
      <a
        href="https://www.twitter.com/fhfhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/socials/twitter.png"
          alt="Twitter"
          width={48}
          height={48}
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
          width={48}
          height={48}
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
          width={48}
          height={48}
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
          width={48}
          height={48}
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
          width={48}
          height={48}
        />
      </a>
    </div>
  );
}

export default SocialMedias;
