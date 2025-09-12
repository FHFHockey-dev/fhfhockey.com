// /Users/tim/Desktop/fhfhockey.com/web/pages/api/v1/db/upsert-csv.ts
import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseClient } from "@supabase/supabase-js";
import { standardizePlayerName } from "lib/standardization/nameStandardization";

// ------------------------------------------------------------
// Name normalization + heuristic helpers
// ------------------------------------------------------------
const stripDiacritics = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalize = (s: string) =>
  stripDiacritics(s)
    .toLowerCase()
    .trim()
    .replace(/[.'`-]/g, "")
    .replace(/\s+/g, " ");

const splitFirstLast = (name: string): [string, string] => {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
};

const lastNameTokens = (name: string) => {
  const [, last] = splitFirstLast(name);
  if (!last) return [] as string[];
  return stripDiacritics(last)
    .split(/[-\s]+/)
    .map((t) => normalize(t))
    .filter(Boolean);
};

// Simple normalized similarity ratio using Levenshtein distance
function similarityRatio(a: string, b: string): number {
  const s = normalize(a);
  const t = normalize(b);
  const m = s.length;
  const n = t.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return (maxLen - dist) / maxLen;
}

const FIRSTNAME_ALIASES: Record<string, string[]> = {
  joshua: ["josh"],
  jacob: ["jake"],
  michael: ["mike"],
  matthew: ["matt"],
  nicholas: ["nick"],
  anthony: ["tony"],
  alexander: ["alex"],
  william: ["will", "bill", "billy"],
  christopher: ["chris"],
  jonathan: ["john", "jon"],
  ukkopekka: ["ukko-pekka", "ukko pekka"],
};

const firstNameSimilar = (a: string, b: string) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // common prefix similarity >= 0.5 of longer
  const minLen = Math.min(na.length, nb.length);
  let common = 0;
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) common++;
    else break;
  }
  if (common / Math.max(na.length, nb.length) >= 0.5) return true;
  const aAliases = FIRSTNAME_ALIASES[na] || [];
  const bAliases = FIRSTNAME_ALIASES[nb] || [];
  if (aAliases.includes(nb) || bAliases.includes(na)) return true;
  return false;
};

// Player Master Type (reflects what is used from the existing table)
type PlayerMasterLookup = {
  id: number; // bigint corresponds to number in JS/TS
  fullName: string;
  position?: string; // Add position, assuming it exists in the 'players' table
};

// Modified helper function: Gets player ID by fullName.
// If multiple matches, attempts to disambiguate using position.
async function getPlayerIdByFullName(
  supabase: SupabaseClient,
  standardizedFullName: string,
  csvRow: Record<string, any> // Pass the current CSV row data
  // The standardized column name for position in csvRow is assumed to be "Position"
): Promise<number | null> {
  if (!standardizedFullName || standardizedFullName.trim() === "") {
    console.warn(
      "Empty or null standardizedFullName received in getPlayerIdByFullName."
    );
    return null;
  }

  // Query for players by fullName (exact), also selecting their position from the database
  // Ensure the 'players' table has a 'position' column.
  let { data: existingPlayers, error: selectError } = await supabase
    .from("players")
    .select("id, position") // Select id and position
    .eq("fullName", standardizedFullName);

  if (selectError) {
    console.error(
      `Error selecting player by fullName '${standardizedFullName}':`,
      selectError
    );
    return null;
  }

  if (!existingPlayers || existingPlayers.length === 0) {
    // Heuristic fallback: last-name exact (normalized), first-name ~50% or alias
    const [csvFirst, csvLastRaw] = splitFirstLast(standardizedFullName);
    const csvLastTokens = lastNameTokens(standardizedFullName);
    if (!csvLastTokens.length) {
      console.warn(
        `Player not found in 'players' table with fullName: '${standardizedFullName}'`
      );
      return null;
    }

    // Coarse candidate fetch by last name pattern
    const tryFetchCandidates = async (pattern: string) =>
      supabase
        .from("players")
        .select("id, fullName, position")
        .ilike("fullName", pattern)
        .limit(5000);
    // Attempt 1: raw last name pattern
    let { data: cand, error: e2 } = await tryFetchCandidates(`%${csvLastRaw}%`);
    // Attempt 2: diacritics-stripped last name pattern
    if ((!cand || !cand.length) && stripDiacritics(csvLastRaw) !== csvLastRaw) {
      const base = stripDiacritics(csvLastRaw);
      const r2 = await tryFetchCandidates(`%${base}%`);
      cand = r2.data || cand;
      e2 = r2.error || e2;
    }
    // Attempt 3: prefix fallback (first 3 letters) to catch diacritic variants
    if (!cand || !cand.length) {
      const prefix = csvLastRaw.slice(0, 3);
      const r3 = await tryFetchCandidates(`%${prefix}%`);
      cand = r3.data || cand;
      e2 = r3.error || e2;
    }
    if (e2) {
      console.error("Error searching players by last name pattern:", e2);
      return null;
    }
    const candidates = (cand || []).filter((p) => p && typeof p.fullName === "string");
    let best: { id: number; score: number; firstOK: boolean } | null = null;
    let bestIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i] as any;
      const pLastTokens = lastNameTokens(p.fullName);
      const lastExact = pLastTokens.some((t) => csvLastTokens.includes(t));
      let lastNear = false;
      if (!lastExact) {
        for (const a of csvLastTokens) {
          for (const b of pLastTokens) {
            const sim = similarityRatio(a, b);
            if (sim >= 0.9) {
              lastNear = true;
              break;
            }
          }
          if (lastNear) break;
        }
      }
      const lastOK = lastExact || lastNear;
      if (!lastOK) continue;
      const [pf] = splitFirstLast(p.fullName);
      const fOK = firstNameSimilar(csvFirst, pf);
      const score = (lastExact ? 1 : (lastNear ? 0.9 : 0)) + (fOK ? 1 : 0);
      if (!best || score > best.score) {
        best = { id: p.id as number, score, firstOK: fOK };
        bestIdx = i;
        if (score === 2) break; // perfect
      }
    }

    if (!best) {
      console.warn(
        `Player not found in 'players' by heuristic for fullName: '${standardizedFullName}'`
      );
      return null;
    }

    // If ambiguous on first name (score 1), try CSV position disambiguation
    if (!best.firstOK) {
      const csvPlayerPosition = csvRow["Position"]
        ? String(csvRow["Position"]).trim().toUpperCase()
        : null;
      if (csvPlayerPosition) {
        const csvPosSet = new Set(
          csvPlayerPosition
            .split(",")
            .map((p) => p.trim().toUpperCase())
            .filter(Boolean)
        );
        const pMatches = (cand || []).filter((p: any) => {
          const pLastTokens = lastNameTokens(p.fullName);
          const lastExact = pLastTokens.some((t: string) => csvLastTokens.includes(t));
          const [pf] = splitFirstLast(p.fullName);
          const fOK = firstNameSimilar(csvFirst, pf);
          const pos = String(p.position || "").trim().toUpperCase();
          const posOk = pos && (csvPosSet.has(pos) || csvPosSet.has((pos.split("/")[0] || pos)));
          return lastExact && posOk;
        });
        if (pMatches.length === 1) {
          console.log(
            `Heuristic disambiguation by position mapped '${standardizedFullName}' to ID ${pMatches[0].id}.`
          );
          return pMatches[0].id as number;
        }
      }
    }

    if (!best.firstOK) {
      // Do not accept a weak match on last name alone; avoid wrong player mapping.
      console.warn(
        `Ambiguous heuristic match for '${standardizedFullName}'. Skipping to avoid misassignment (score=${best.score}).`
      );
      return null;
    }

    console.log(
      `Heuristic matched '${standardizedFullName}' to ID ${best.id} (score=${best.score}).`
    );
    return best.id;
  }

  if (existingPlayers.length === 1) {
    return existingPlayers[0].id as number;
  }

  // Multiple players found with the same name, attempt to disambiguate by position
  console.warn(
    `Ambiguous player name: '${standardizedFullName}'. Found ${existingPlayers.length} players. Attempting to disambiguate by position.`
  );

  const csvPlayerPosition = csvRow["Position"]
    ? String(csvRow["Position"]).trim().toUpperCase()
    : null;

  if (!csvPlayerPosition) {
    console.warn(
      `Cannot disambiguate '${standardizedFullName}': Position not found or empty in CSV row for key 'Position'. Skipping.`
    );
    return null;
  }

  const csvPosSet = new Set(
    csvPlayerPosition
      .split(",")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)
  );
  const matchedPlayer = existingPlayers.find((player) => {
    const pos = player.position ? String(player.position).trim().toUpperCase() : "";
    return pos && (csvPosSet.has(pos) || csvPosSet.has((pos.split("/")[0] || pos)));
  });

  if (matchedPlayer) {
    console.log(
      `Disambiguated '${standardizedFullName}' to ID ${matchedPlayer.id} using position '${csvPlayerPosition}'.`
    );
    return matchedPlayer.id as number;
  } else {
    console.warn(
      `Could not disambiguate '${standardizedFullName}' with CSV position '${csvPlayerPosition}'. DB positions: ${existingPlayers.map((p) => p.position).join(", ")}. Skipping.`
    );
    return null;
  }
}

export default adminOnly(
  async (
    req: NextApiRequest & { supabase: SupabaseClient },
    res: NextApiResponse
  ) => {
    console.log("API ROUTE /api/v1/db/upsert-csv CALLED. Method:", req.method);
    // console.log("Raw request body content received:", req.body); // Potentially very verbose

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end("Method Not Allowed");
    }

    const { supabase } = req;
    let parsedBody;

    // Body parsing (remains the same)
    if (typeof req.body === "string") {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e: any) {
        return res
          .status(400)
          .json({ success: false, message: "Malformed JSON request body." });
      }
    } else if (typeof req.body === "object" && req.body !== null) {
      parsedBody = req.body;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request body format." });
    }

    const {
      tableName,
      columns,
      csvData,
      playerIdentifierColumnName
    }: {
      tableName: string;
      columns: { name: string; type: string; isPlayerNameSource?: boolean }[];
      csvData: Record<string, any>[];
      playerIdentifierColumnName: string;
    } = parsedBody;
    console.log(`[API] Received csvData with ${csvData.length} rows.`);

    // Table and column validation (remains the same)
    console.log(`Validating tableName: "[${tableName}]"`);
    if (!tableName || !/^[a-zA-Z_][a-zA-Z0-9_]{2,62}$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid table name. Must be 3-63 chars, start with letter/underscore, and contain only letters, numbers, or underscores."
      });
    }
    console.log(`Table name "[${tableName}]" PASSED validation.`);

    if (!columns || columns.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No columns defined for the table." });
    }

    const validDataTypes = [
      "TEXT",
      "INTEGER",
      "NUMERIC",
      "BOOLEAN",
      "DATE",
      "TIMESTAMP WITH TIME ZONE",
      "UUID",
      "BIGINT"
    ];
    const sanitizedColumns: {
      name: string;
      type: string;
      isPlayerNameSource?: boolean;
    }[] = [];

    for (const col of columns) {
      const upperColType = col.type?.toUpperCase();
      if (!col.name || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(col.name)) {
        return res.status(400).json({
          success: false,
          message: `Invalid column name: ${col.name}.`
        });
      }
      if (!upperColType || !validDataTypes.includes(upperColType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid data type for column ${col.name}: ${col.type}`
        });
      }
      sanitizedColumns.push({
        name: col.name,
        type: upperColType,
        isPlayerNameSource: col.isPlayerNameSource
      });
    }

    const playerInputColConfig = columns.find(
      (c) => c.isPlayerNameSource === true
    );
    if (!playerInputColConfig) {
      return res.status(400).json({
        success: false,
        message: "Configuration error: No column marked as player name source."
      });
    }
    const playerIdentifierColInNewTable = sanitizedColumns.find(
      (sc) => sc.name === playerIdentifierColumnName
    );
    if (!playerIdentifierColInNewTable) {
      console.warn(
        `The column '${playerIdentifierColumnName}' (holding standardized player names) was not selected to be part of the new table. Player names from CSV will still be used for linking via player_id, but this column itself won't be in the new table.`
      );
    }

    try {
      // Table creation SQL (remains the same)
      let createTableSQL = `CREATE TABLE IF NOT EXISTS public."${tableName}" (`;
      createTableSQL += `"upload_batch_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), `;
      createTableSQL += `"player_id" BIGINT, `;
      const columnDefinitions = sanitizedColumns.map(
        (col) => `"${col.name}" ${col.type}`
      );
      createTableSQL += columnDefinitions.join(", ");
      createTableSQL += `, CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES public.players(id)`;
      createTableSQL += `);`;

      console.log(
        "Attempting to execute SQL for table creation/check:",
        createTableSQL
      );
      const { error: createError } = await supabase.rpc("execute_sql", {
        sql_statement: createTableSQL
      });

      if (createError) {
        console.error("Table creation RPC error:", createError);
        if (
          !createError.message.includes("already exists") &&
          !createError.message.includes("relation") &&
          !createError.message.includes("exists")
        ) {
          throw new Error(`Table creation RPC failed: ${createError.message}`);
        } else {
          console.warn(
            `Table "${tableName}" likely already exists. Message: ${createError.message}`
          );
        }
      } else {
        console.log(`Table "${tableName}" checked/created successfully.`);
      }

      const dataForSupabase: Record<string, any>[] = [];
      let skippedRowCount = 0;
      for (const row of csvData) {
        // `row` here is a single CSV data record
        const supabaseRow: Record<string, any> = {};
        const standardizedFullNameFromCSV = row[playerIdentifierColumnName];

        if (
          !standardizedFullNameFromCSV ||
          typeof standardizedFullNameFromCSV !== "string" ||
          standardizedFullNameFromCSV.trim() === ""
        ) {
          console.warn(
            "Skipping row due to missing/empty standardized player name in input data under column:",
            playerIdentifierColumnName,
            "Row data (first few fields):",
            Object.fromEntries(Object.entries(row).slice(0, 3))
          );
          skippedRowCount++;
          continue;
        }

        const finalStandardizedNameForLookup = standardizePlayerName(
          standardizedFullNameFromCSV
        );

        // Call getPlayerIdByFullName with the current row for potential position disambiguation
        const playerId = await getPlayerIdByFullName(
          supabase,
          finalStandardizedNameForLookup,
          row
        );

        if (playerId === null) {
          // console.warn already happens in getPlayerIdByFullName
          // Log the original CSV name for context if it differs from finalStandardizedNameForLookup
          if (standardizedFullNameFromCSV !== finalStandardizedNameForLookup) {
            console.log(
              `(Original CSV name for above skipped player was: '${standardizedFullNameFromCSV}')`
            );
          }
          skippedRowCount++;
          continue;
        }
        supabaseRow["player_id"] = playerId;

        // Data type conversion and row preparation (remains the same)
        for (const colDef of sanitizedColumns) {
          let value = row[colDef.name];
          if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
          ) {
            if (colDef.type === "INTEGER") {
              const parsedInt = parseInt(String(value), 10);
              value = isNaN(parsedInt) ? null : parsedInt;
            } else if (colDef.type === "NUMERIC") {
              const parsedFloat = parseFloat(String(value));
              value = isNaN(parsedFloat) ? null : parsedFloat;
            } else if (colDef.type === "BOOLEAN") {
              value = ["true", "1", "yes", "t"].includes(
                String(value).toLowerCase()
              );
            } else if (
              colDef.type === "DATE" ||
              colDef.type === "TIMESTAMP WITH TIME ZONE"
            ) {
              const parsedDate = new Date(String(value));
              value = isNaN(parsedDate.getTime())
                ? null
                : parsedDate.toISOString();
            }
          } else {
            value = null;
          }
          supabaseRow[colDef.name] = value;
        }
        dataForSupabase.push(supabaseRow);
      }

      if (dataForSupabase.length === 0 && csvData.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No data could be prepared for upsert. ${skippedRowCount} rows were skipped, possibly due to player ID issues or missing player names.`
        });
      }
      if (dataForSupabase.length === 0 && csvData.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No CSV data found to process." });
      }

      console.log(
        `Attempting to insert ${dataForSupabase.length} rows into public."${tableName}". ${skippedRowCount} rows skipped.`
      );
      const { error: upsertError } = await supabase
        .from(tableName)
        .insert(dataForSupabase);

      if (upsertError) {
        console.error("Supabase Insert error:", upsertError);
        throw new Error(`Data insertion failed: ${upsertError.message}.`);
      }

      return res.status(200).json({
        success: true,
        message: `Successfully processed. Inserted ${dataForSupabase.length} rows into table '${tableName}'. ${skippedRowCount} CSV rows were skipped.`
      });
    } catch (error: any) {
      console.error(
        "Overall error in /api/v1/db/upsert-csv:",
        error.message,
        error.stack
      );
      return res.status(500).json({
        success: false,
        message: error.message || "An unexpected error occurred."
      });
    }
  }
);
