import { ApolloClient, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
    uri: process.env.NEXT_PUBLIC_SANITY_GRAPHQL_URI,
    cache: new InMemoryCache(),
});

export default client;