import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeTestingGroundsOwner, privateTestingGroundsResponse } from "./serverOwnerBoundary";

const operationalReads = ["progress", "health", "manifest"] as const;
const sealedReads = ["logs", "results", "export"] as const;
const actions = ["cancel", "retry", "reveal"] as const;
type OperationalRead = typeof operationalReads[number];
type SealedRead = typeof sealedReads[number];
type Action = typeof actions[number];
type Operation = OperationalRead | SealedRead | Action;

/**
 * Server-only adapter seam, deliberately unwired in the exported route wrappers.
 * Future adapters must validate their operational projections and independently
 * enforce the approved reveal policy; a run state or client flag is not authority.
 * No worker checkpoint/claim/finish API is exposed here.
 */
export type OwnerReadStore = {
  listOwned: (ownerId: string) => Promise<unknown>;
  findOwned: (ownerId: string, runId: string) => Promise<{ ownerUserId: string; runId: string } | null>;
  readOperational: (ownerId: string, runId: string, operation: OperationalRead) => Promise<unknown>;
  authorizeSealedRead: (ownerId: string, runId: string) => Promise<boolean>;
  readSealed: (ownerId: string, runId: string, operation: SealedRead) => Promise<unknown>;
};

type Options = {
  authorize?: typeof authorizeTestingGroundsOwner;
  store?: OwnerReadStore;
  trustedOrigin?: string;
};

function validOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch { return false; }
}

function allowMutation(req: NextApiRequest, res: NextApiResponse, trustedOrigin: unknown) {
  if (!validOrigin(trustedOrigin)) {
    res.status(503).json({ error: "mutation_not_configured" }); return false;
  }
  if (req.headers.origin !== trustedOrigin || req.headers["sec-fetch-site"] === "cross-site") {
    res.status(403).json({ error: "forbidden_origin" }); return false;
  }
  if (typeof req.headers["content-type"] !== "string"
    || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers["content-type"])) {
    res.status(415).json({ error: "json_required" }); return false;
  }
  return true;
}

/** Every handler re-verifies owner access before any storage or action boundary. */
export function createTestingGroundsRoutes(options: Options = {}) {
  const authorize = options.authorize ?? authorizeTestingGroundsOwner;
  const unavailable = (res: NextApiResponse) => res.status(503).json({ error: "runner_not_connected" });

  function route(kind: "access" | "collection" | "run") {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      privateTestingGroundsResponse(res);
      try {
        const owner = await authorize(req, res);
        if (!owner) return;
        const operation = req.query.operation;
        const knownOperation = typeof operation === "string"
          && [...operationalReads, ...sealedReads, ...actions].includes(operation as Operation);
        if (kind === "run" && !knownOperation) {
          res.status(404).json({ error: "not_found" }); return;
        }
        const mutation = kind === "collection" ? req.method === "POST"
          : kind === "run" && actions.includes(operation as Action);
        const methods = kind === "collection" ? ["GET", "POST"] : [mutation ? "POST" : "GET"];
        if (!methods.includes(req.method ?? "")) {
          res.setHeader("Allow", methods.join(", "));
          res.status(405).json({ error: "method_not_allowed" }); return;
        }
        if (kind === "access") {
          res.status(200).json({ access: "owner", workspace: "synthetic_preview", execution: "disabled" }); return;
        }
        if (mutation && !allowMutation(req, res, options.trustedOrigin)) return;
        // Even valid owner mutations remain inactive: no launch, cancellation,
        // retry, or reveal provider is installed by this local integration slice.
        if (mutation) { unavailable(res); return; }
        if (!options.store) { unavailable(res); return; }
        const store = options.store;
        if (kind === "collection") {
          res.status(200).json(await store.listOwned(owner.ownerUserId)); return;
        }
        const runId = req.query.runId;
        if (typeof runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(runId)) {
          res.status(404).json({ error: "not_found" }); return;
        }
        const resource = await store.findOwned(owner.ownerUserId, runId);
        if (!resource || resource.ownerUserId !== owner.ownerUserId || resource.runId !== runId) {
          res.status(404).json({ error: "not_found" }); return;
        }
        if (sealedReads.includes(operation as SealedRead)) {
          if (await store.authorizeSealedRead(owner.ownerUserId, runId) !== true) {
            res.status(403).json({ error: "results_sealed" }); return;
          }
          res.status(200).json(await store.readSealed(owner.ownerUserId, runId, operation as SealedRead)); return;
        }
        res.status(200).json(await store.readOperational(owner.ownerUserId, runId, operation as OperationalRead));
      } catch {
        // Never reflect provider errors, request values, stack traces or payloads.
        res.status(503).json({ error: "testing_grounds_unavailable" });
      }
    };
  }
  return { access: route("access"), collection: route("collection"), run: route("run") };
}

// No store, scheduler or mutation origin is configured. These routes cannot run jobs.
export const testingGroundsRoutes = createTestingGroundsRoutes();
