import type { NextApiRequest, NextApiResponse } from "next";

class ManualCronAuditError extends Error {
  constructor(readonly persistence: "failed" | "unverified") { super("Required audit persistence was not acknowledged."); }
}

/** Manual writers retain their existing row/context and never retry an insert. */
export async function persistManualCronAudit(client: any, row: unknown): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = client.from("cron_job_audit").insert(row);
    const pending = typeof query?.abortSignal === "function" ? query.abortSignal(controller.signal) : query;
    const receipt = await Promise.race([
      Promise.resolve(pending),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new ManualCronAuditError("unverified")); }, 5000);
      }),
    ]);
    if (receipt?.error) throw new ManualCronAuditError("failed");
    if (!receipt || receipt.error !== null) throw new ManualCronAuditError("unverified");
  } catch (error) {
    throw error instanceof ManualCronAuditError ? error : new ManualCronAuditError("unverified");
  } finally { clearTimeout(timer); }
}

/** Transport/audit durability is separate from the operation's recorded result. */
export function cronAuditFailureResponse(body: unknown, statusCode: number, persistence: "failed" | "unverified", owner: string) {
  const operation = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return { ...operation, success: false,
    error: typeof operation.error === "string" && operation.error.trim() ? operation.error
      : "Audit persistence was not acknowledged. Data writes may have committed; inspect before rerunning.",
    operationOutcome: { statusCode, success: typeof operation.success === "boolean" ? operation.success : null },
    finalAudit: { owner, status: persistence, retrySafe: false, requiresReview: true } };
}

/** Hold the response until a handler-owned audit settles; never add a second row. */
export function withManualCronAuditResponse(handler: (req: any, res: any) => any) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const json = res.json.bind(res);
    const send = typeof res.send === "function" ? res.send.bind(res) : null;
    let pending: { kind: "json" | "send"; body: any } | undefined;
    res.json = ((body: any) => { pending = { kind: "json", body }; return res; }) as any;
    if (send) res.send = ((body: any) => { pending = { kind: "send", body }; return res; }) as any;
    try { await handler(req, res); }
    catch (error) {
      if (!(error instanceof ManualCronAuditError)) throw error;
      console.error("Required manual cron audit was not acknowledged", error.persistence);
      const operationStatus = res.statusCode;
      res.status(503);
      pending = { kind: "json", body: cronAuditFailureResponse(pending?.body, operationStatus, error.persistence, "manual") };
    } finally {
      res.json = json as any;
      if (send) res.send = send as any;
      if (pending?.kind === "json") json(pending.body);
      else if (pending?.kind === "send" && send) send(pending.body);
    }
  };
}
