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
