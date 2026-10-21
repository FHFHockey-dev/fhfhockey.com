// Browser-safe bridge: only the server projection runner installs the Node
// capture implementation. Shared Supabase imports must not bundle async_hooks.
type QueryInterceptor = (method: "from" | "rpc", args: unknown[], live: () => any) => any;
let interceptor: QueryInterceptor | undefined;

export function installProjectionQueryInterceptor(value: QueryInterceptor) {
  interceptor = value;
}

export function interceptProjectionQuery(method: "from" | "rpc", args: unknown[], live: () => any) {
  return interceptor?.(method, args, live);
}

// True inside read-only FORGE reconstruction, where RPCs are refused: readers
// with a table-read fallback take it instead of attempting the RPC.
let readOnlyProbe: (() => boolean) | undefined;

export function installProjectionReadOnlyProbe(value: () => boolean) {
  readOnlyProbe = value;
}

export function isReadOnlyProjectionReconstruction() {
  return readOnlyProbe?.() === true;
}
