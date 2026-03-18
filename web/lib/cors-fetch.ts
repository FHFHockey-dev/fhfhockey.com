// cors-fetch.ts

const isServer = typeof window === "undefined";

export default function Fetch(url: string) {
  if (isServer) {
    return fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
      },
      cache: "no-store"
    });
  } else {
    return fetch(`/api/cors?url=${encodeURIComponent(url)}`);
  }
}
