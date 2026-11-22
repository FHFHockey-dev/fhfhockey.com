export const counters = { reads: 0, bytes: 0 };
const orig = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const res = await orig(input, init);
  const buf = await res.arrayBuffer();
  counters.reads++; counters.bytes += buf.byteLength;
  return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
}) as typeof fetch;
