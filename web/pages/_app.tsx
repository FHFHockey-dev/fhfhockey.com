// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/_app.tsx

import Head from "next/head";
import dynamic from "next/dynamic";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { AppProps } from "next/app";
import AuthProvider from "contexts/AuthProviderContext/index";
import { DefaultSeo } from "next-seo";
import SEO from "next-seo.config";
import { canonicalUrl, isNoindexPath } from "lib/seo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "../components/Layout";
import "../styles/globals.css";
import "../styles/vars.scss";

import "../styles/Home.module.scss";
import "components/TeamLandingPage/teamLandingPage.scss";

const queryClient = new QueryClient();

// notistack (and the MUI it pulls in) loads only on routes that show snackbars:
// the /db admin pages and /auth, where /db's access-denied notice lands.
const SnackbarProvider = dynamic(() =>
  import("notistack").then((mod) => mod.SnackbarProvider)
);
const SNACKBAR_ROUTE = /^\/(db(\/|$)|auth$)/;

function MyApp({ Component, pageProps, router }: AppProps) {
  const noindex = isNoindexPath(router.pathname);
  const canonical = noindex ? undefined : canonicalUrl(router.asPath);

  const AppContent = (
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

        <meta name="theme-color" content="#07aae2" />
        <meta name="msapplication-navbutton-color" content="#07aae2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="#000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <DefaultSeo {...SEO} canonical={canonical} openGraph={{ ...SEO.openGraph, url: canonical }} />
      <QueryClientProvider client={queryClient}>
        {/* Wrapping only the page slot keeps the provider mounted across
            /db -> /auth redirects without remounting the shared layout. */}
        {SNACKBAR_ROUTE.test(router.pathname) ? (
          <SnackbarProvider maxSnack={3} autoHideDuration={6000}>
            <Component {...pageProps} />
          </SnackbarProvider>
        ) : (
          <Component {...pageProps} />
        )}
      </QueryClientProvider>
      {noindex && (
        <Head>
          <meta name="robots" content="noindex,follow" key="robots" />
          <meta name="googlebot" content="noindex,follow" key="googlebot" />
        </Head>
      )}
    </Layout>
  );

  // Apollo is provided by its only consumer (blog comments), so it stays out
  // of the shared app chunk.
  return (
    <>
      <AuthProvider>{AppContent}</AuthProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default MyApp;
