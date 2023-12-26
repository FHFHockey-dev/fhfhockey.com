export default function Fetch(url: string) {
  return fetch(`/api/cors?url=${url}`);
}
