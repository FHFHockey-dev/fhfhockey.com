import Head from "next/head";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { ApolloProvider } from "@apollo/client";
import client from "../lib/apollo-client";

import Layout from "../components/Layout";
import "../styles/globals.css";
import "../styles/vars.scss";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  return (
    <ApolloProvider client={client}>
      <Layout>
        <Head>
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            // https://css-tricks.com/the-notch-and-css/
            content="width=device-width, initial-scale=1.0,viewport-fit=cover"
          />
          <meta
            name="keywords"
            content="Fantasy Hockey, Fantasy Hockey Podcast, Five Hole, NHL, Fantasy, Fantasy Sports"
          />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/site.webmanifest" />
        </Head>
        {/* https://nextjs.org/docs/api-reference/next/router#resetting-state-after-navigation */}
        <Component key={router.asPath} {...pageProps} />
      </Layout>
    </ApolloProvider>
  );
}

export default MyApp;
