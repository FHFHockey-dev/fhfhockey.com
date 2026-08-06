import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { collectPlayerForecastReadiness } from "../lib/player-forecasts/readiness";
import { getServiceRoleClient } from "../lib/supabase/server";

async function main() {
  const readiness = await collectPlayerForecastReadiness({
    supabase: getServiceRoleClient(),
  });
  process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`);
  process.exitCode = readiness.readyForContractSmoke ? 0 : 1;
}

main().catch(() => {
  process.stderr.write(
    "Player Forecasts readiness failed without exposing sensitive details.\n",
  );
  process.exitCode = 1;
});
