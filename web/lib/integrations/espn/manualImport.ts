import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import {
  FantraxImportError,
  type FantraxImportPayload,
  getManualProviderImportBlock,
  getManualProviderImportState,
  type ManualImportProviderConfig,
  parseFantraxImport,
  runManualProviderImport,
  setManualProviderActiveTeam,
  setManualProviderDefaultTeam,
} from "lib/integrations/fantrax/manualImport";

import { ESPN_PROVIDER } from "./config";

const ESPN_IMPORT_COOLDOWN_MS = 15 * 1000;
const ESPN_IMPORT_STALE_MS = 10 * 60 * 1000;

export const ESPN_MANUAL_IMPORT_CONFIG: ManualImportProviderConfig = {
  provider: ESPN_PROVIDER,
  displayName: "ESPN",
  defaultAccountLabel: "ESPN manual import",
  cooldownMs: ESPN_IMPORT_COOLDOWN_MS,
  staleMs: ESPN_IMPORT_STALE_MS,
};

export { FantraxImportError as EspnImportError };

function espnMessage(message: string) {
  return message.replaceAll("Fantrax", "ESPN");
}

export function parseEspnImport(
  content: unknown,
  format?: string | null,
): FantraxImportPayload {
  try {
    const payload = parseFantraxImport(content, format);
    return {
      ...payload,
      accountLabel:
        payload.accountLabel === "Fantrax manual import"
          ? ESPN_MANUAL_IMPORT_CONFIG.defaultAccountLabel
          : payload.accountLabel,
    };
  } catch (error) {
    if (error instanceof FantraxImportError) {
      throw new FantraxImportError(
        espnMessage(error.message),
        error.statusCode,
        error.retryAfterSeconds,
      );
    }
    throw error;
  }
}

export function getEspnImportBlock(
  latestRun: Parameters<typeof getManualProviderImportBlock>[0],
  now: Date,
) {
  return getManualProviderImportBlock(
    latestRun,
    now,
    ESPN_MANUAL_IMPORT_CONFIG,
  );
}

export async function runEspnManualImport(args: {
  userId: string;
  content: unknown;
  format?: string | null;
  client?: SupabaseClient<Database>;
  now?: () => Date;
}) {
  return runManualProviderImport({
    ...args,
    providerConfig: ESPN_MANUAL_IMPORT_CONFIG,
    parseImport: parseEspnImport,
  });
}

export async function setEspnDefaultTeam(args: {
  userId: string;
  teamId: string;
  client?: SupabaseClient<Database>;
}) {
  return setManualProviderDefaultTeam({
    ...args,
    providerConfig: ESPN_MANUAL_IMPORT_CONFIG,
  });
}

export async function setEspnActiveTeam(args: {
  userId: string;
  teamId: string;
  client?: SupabaseClient<Database>;
}) {
  return setManualProviderActiveTeam({
    ...args,
    providerConfig: ESPN_MANUAL_IMPORT_CONFIG,
  });
}

export async function getEspnImportState(args: {
  userId: string;
  client?: SupabaseClient<Database>;
}) {
  return getManualProviderImportState({
    ...args,
    providerConfig: ESPN_MANUAL_IMPORT_CONFIG,
  });
}
