import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.scss";
import Banner from "../components/Banner";

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>FHFH | Home</title>
        <meta
          name="google-site-verification"
          content="ilj1AkBDPlpfcKH8A0zBJUdKtcUjE8TKIyCLa6buHxk"
        />
        <meta
          name="description"
          content="Five Hole Fantasy Hockey Podcast Home page."
        />
      </Head>
      <Banner className={styles.socialMedia}>
        <a
          href="https://www.twitter.com/fhfhockey"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/pictures/twitter.png"
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
            src="/pictures/discord.png"
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
            src="/pictures/patreon.png"
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
            src="/pictures/youtube.png"
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
