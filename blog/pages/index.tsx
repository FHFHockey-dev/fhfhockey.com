import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>FHFH Blog</title>
      </Head>

      <main>
        The blog app
        <Link href="/">
          <a>Home Page</a>
        </Link>
      </main>

      <footer className={styles.footer}>blog footer</footer>
    </div>
  );
};

export default Home;
