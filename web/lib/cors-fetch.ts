// cors-fetch.ts

const isServer = typeof window === "undefined";

export default function Fetch(url: string, init?: RequestInit) {
  if (isServer) {
    const { headers: initHeaders, ...restInit } = init ?? {};
    return fetch(url, {
      ...restInit,
      headers: {
        Accept: "application/json",
        "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
        ...(initHeaders ?? {})
      },
      cache: restInit.cache ?? "no-store"
    });
  } else {
    return fetch(`/api/cors?url=${encodeURIComponent(url)}`);
  }
}
