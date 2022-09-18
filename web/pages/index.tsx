import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import { NextSeo } from "next-seo";

import styles from "../styles/Home.module.scss";
import Banner from "../components/Banner";
import SocialMedias from "components/SocialMedias";

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
        <SocialMedias />
      </Banner>
    </div>
  );
};

export default Home;
