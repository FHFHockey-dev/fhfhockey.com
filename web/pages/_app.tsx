import "../styles/globals.css";
import type { AppProps } from "next/app";
import Layout from "./components/Layout";
import Head from "next/head";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="keywords"
          content="Fantasy Hockey, Fantasy Hockey Podcast, Five Hole, NHL, Fantasy, Fantasy Sports"
        />
      </Head>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;
