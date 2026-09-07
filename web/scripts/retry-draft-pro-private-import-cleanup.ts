import "dotenv/config";

import { cleanupPrivateImports } from "lib/draft-pro/privateImportCleanup";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function userIdFromArgs(argv: string[]) {
  if (argv.length !== 1 || !argv[0]?.startsWith("--user-id=")) throw new Error("Usage: retry-draft-pro-private-import-cleanup --user-id=<uuid>");
  const userId = argv[0].slice("--user-id=".length);
  if (!UUID.test(userId)) throw new Error("--user-id must be a UUID.");
  return userId;
}

async function main() {
  const userId = userIdFromArgs(process.argv.slice(2));
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("This cleanup retry command only runs against local Supabase.");
  const result = await cleanupPrivateImports(userId);
  console.log(JSON.stringify(result));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Private import cleanup retry failed.");
  process.exitCode = 1;
});
