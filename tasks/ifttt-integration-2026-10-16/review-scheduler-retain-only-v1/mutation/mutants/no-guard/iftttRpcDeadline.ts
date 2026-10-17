export type IftttRpcResult = { data: any; error: any };
export type IftttRpcQuery = PromiseLike<IftttRpcResult> & { abortSignal(signal: AbortSignal): IftttRpcQuery };
export type IftttRpcClient = { rpc(name: string, args: Record<string, unknown>): IftttRpcQuery };

// A 5s server statement budget plus transport headroom; reconciliation has its
// own 1s server/2s request budget. Neither abort proves database rollback.
export const IFTTT_RPC_DEADLINES = Object.freeze({ writeMs: 6000, readMs: 2000 });

export class IftttIntakeOutcomeUnknown extends Error {
  readonly code = "IFTTT_OUTCOME_UNKNOWN";
  constructor() { super("IFTTT retention outcome is unknown; read-only reconciliation is required"); }
}

/** Race as well as abort: a late/abort-ignoring transport must not hold the handler. */
export async function boundedIftttRpc(db: IftttRpcClient, name: string, args: Record<string, unknown>, milliseconds: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { reject(new IftttIntakeOutcomeUnknown()); controller.abort(); }, milliseconds);
  });
  try {
    const query = db.rpc(name, args).abortSignal(controller.signal);
    return await Promise.race([Promise.resolve(query), deadline]);
  } finally { clearTimeout(timer); }
}
