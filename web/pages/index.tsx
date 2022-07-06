import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>FHFH</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <b>FHFH</b>
        </h1>
        <br />
        <Link href="/blog">
          <button>Open Blog</button>
        </Link>

        <br />
        <Link href="/studio">
          <button>Open Sanity Studio</button>
        </Link>
      </main>

      <footer className={styles.footer}>Main App Footer</footer>
    </div>
  );
};

export default Home;
