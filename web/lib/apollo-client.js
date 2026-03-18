import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

if (typeof globalThis !== "undefined") {
  globalThis[Symbol.for("apollo.deprecations")] = true;
}

const uri = process.env.NEXT_PUBLIC_SANITY_GRAPHQL_URI;
const link = uri
  ? new HttpLink({ uri, fetch: typeof fetch !== "undefined" ? fetch : undefined })
  : null;

const client = new ApolloClient({
  cache: new InMemoryCache(),
  ...(link ? { link } : {}),
});

export default client;
