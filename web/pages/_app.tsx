import Head from "next/head";
import { Analytics } from "@vercel/analytics/react";
import type { AppProps } from "next/app";
import { ApolloProvider } from "@apollo/client";
import AuthProvider from "contexts/AuthProviderContext/index";
import { DefaultSeo } from "next-seo";
import SEO from "next-seo.config";

import client from "../lib/apollo-client";
import Layout from "../components/Layout";
import "../styles/globals.css";
import "../styles/vars.scss";

// TODO: rewrite using css module
import "../styles/Home.scss";
import "pages/game/GamePage.scss";
// C:\Users\timbr\OneDrive\Desktop\reactApp\fhfhockey.com\web\components\teamLandingPage\teamLandingPage.scss
import "components/teamLandingPage/teamLandingPage.scss"


function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <Layout>
          <Head>
            <meta charSet="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
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

            {/* theme color */}
            <meta name="theme-color" content="#07aae2" />
            {/* <!-- Windows Phone --> */}
            <meta name="msapplication-navbutton-color" content="#07aae2" />
            {/* <!-- iOS Safari --> */}
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="#000" />
            <link rel="manifest" href="/site.webmanifest" />
          </Head>
          <DefaultSeo {...SEO} />
          {/* https://nextjs.org/docs/api-reference/next/router#resetting-state-after-navigation */}
          <Component {...pageProps} />
        </Layout>
        <Analytics />
      </AuthProvider>
    </ApolloProvider>
  );
}

export default MyApp;
