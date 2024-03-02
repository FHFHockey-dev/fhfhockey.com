const isServer = typeof window === "undefined";

export default function Fetch(url: string) {
  if (isServer) {
    return fetch(url);
  } else {
    return fetch(`/api/cors?url=${encodeURIComponent(url)}`);
  }
}
