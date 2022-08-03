import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import { NextSeo } from "next-seo";

import styles from "../styles/Home.module.scss";
import Banner from "../components/Banner";

const Home: NextPage = () => {
  return (
    <div>
      <NextSeo
        title="FHFH | Home"
        description="Five Hole Fantasy Hockey Podcast Home page."
        openGraph={{
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_SITE_URL}/pictures/circle.png`,
              alt: "logo",
            },
          ],
        }}
      />
      <Head>
        <meta
          name="google-site-verification"
          content="ilj1AkBDPlpfcKH8A0zBJUdKtcUjE8TKIyCLa6buHxk"
        />
      </Head>
      <Banner className={styles.socialMedia}>
        <a
          href="https://www.twitter.com/fhfhockey"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/pictures/white-twitter.png"
            alt="Twitter"
            width={35}
            height={35}
          />
        </a>
        <a
          href="https://discord.gg/kfnyrn7"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/pictures/white-discord.png"
            alt="Discord"
            width={50}
            height={28}
          />
        </a>
        <a
          href="https://www.patreon.com/FHFHRadio"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/pictures/white-patreon.png"
            alt="Patreon"
            width={32}
            height={32}
          />
        </a>
        <a
          href="https://www.youtube.com/fiveholefantasyhockey"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/pictures/white-youtube.png"
            alt="Youtube"
            width={35}
            height={35}
          />
        </a>
      </Banner>
    </div>
  );
};

export default Home;
