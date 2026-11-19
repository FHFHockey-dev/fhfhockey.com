export function tweetPublicationFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^(?:www\.)?(?:twitter\.com|x\.com)$/.test(url.hostname)) return null;
    const id = url.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status(?:es)?\/(\d{15,20})\/?$/)?.[1];
    if (!id || BigInt(id) > BigInt("18446744073709551615")) return null;
    // X Snowflake creation time, not application receipt time. Keep IDs as strings:
    // https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala
    const timestamp = Number((BigInt(id) >> BigInt(22)) + BigInt("1288834974657"));
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}
