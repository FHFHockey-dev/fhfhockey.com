import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  return (
    <section id="homePageBanner">
      <div className="container">
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
            style={{ paddingLeft: "31px" }}
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
            style={{
              paddingLeft: "20px",
              paddingBottom: "3px",
            }}
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
            style={{ paddingLeft: "25px" }}
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
            style={{ paddingLeft: "25px" }}
          />
        </a>
      </div>
    </section>
  );
};

export default Home;
