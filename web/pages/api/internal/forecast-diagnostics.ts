import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";
import { DiagnosticReadError, loadForecastDiagnostics, loadLocalFrozenPairDiagnostics, parseDiagnosticQuery, type DiagnosticReadClient } from "lib/forecast-diagnostics/loader";

export const config = { maxDuration: 60 };

export async function forecastDiagnosticsHandler(req: NextApiRequest & { supabase: SupabaseClient<Database> }, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ success: false, message: "Method not allowed." }); }
  try {
    const query = parseDiagnosticQuery(req.query);
    const localDirectory = process.env.FHFH_FORECAST_DIAGNOSTICS_LOCAL_PACKET_DIRECTORY;
    const report = localDirectory ? await loadLocalFrozenPairDiagnostics(localDirectory, query)
      : await loadForecastDiagnostics(req.supabase as unknown as DiagnosticReadClient, query);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(error instanceof DiagnosticReadError ? error.status : 503).json({ success: false,
      message: error instanceof DiagnosticReadError ? error.message : "Diagnostic evidence could not be read." });
  }
}

export default adminOnly(forecastDiagnosticsHandler);
