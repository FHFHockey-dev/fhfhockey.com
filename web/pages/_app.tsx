// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/_app.tsx

import Head from "next/head";
import { Analytics } from "@vercel/analytics/react";
import type { AppProps } from "next/app";
import { ApolloProvider } from "@apollo/client";
import { SnackbarProvider } from "notistack";
import AuthProvider from "contexts/AuthProviderContext/index";
import { DefaultSeo } from "next-seo";
import SEO from "next-seo.config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import client from "../lib/apollo-client";
import Layout from "../components/Layout";
import "../styles/globals.css";
import "../styles/vars.scss";

// TODO: rewrite using css module
import "../styles/Home.scss";
import "pages/game/GamePage.scss";
import "components/TeamLandingPage/teamLandingPage.scss";
const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ApolloProvider client={client}>
      <SnackbarProvider maxSnack={3} autoHideDuration={6000}>
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
                href="/fhfh-favicon-32x32.png"
              />
              <link
                rel="icon"
                type="image/png"
                sizes="16x16"
                href="/fhfh-favicon-16x16.png"
              />

              {/* theme color */}
              <meta name="theme-color" content="#07aae2" />
              {/* <!-- Windows Phone --> */}
              <meta name="msapplication-navbutton-color" content="#07aae2" />
              {/* <!-- iOS Safari --> */}
              <meta name="apple-mobile-web-app-capable" content="yes" />
              <meta
                name="apple-mobile-web-app-status-bar-style"
                content="#000"
              />
              <link rel="manifest" href="/site.webmanifest" />
            </Head>
            <DefaultSeo {...SEO} />
            <QueryClientProvider client={queryClient}>
              {/* https://nextjs.org/docs/api-reference/next/router#resetting-state-after-navigation */}
              <Component {...pageProps} />
            </QueryClientProvider>
          </Layout>
          <Analytics />
        </AuthProvider>
      </SnackbarProvider>
    </ApolloProvider>
  );
}

export default MyApp;
