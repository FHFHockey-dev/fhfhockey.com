// /Users/tim/Desktop/fhfhockey.com/web/pages/api/v1/db/upsert-csv.ts
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseClient } from "@supabase/supabase-js";
import { standardizePlayerName } from "lib/standardization/nameStandardization";

// ------------------------------------------------------------
// Player identity (W3-3 D11): a CSV row links to a player only by an exact
// standardized fullName match, disambiguated among exact matches by CSV
// position. No last-name, prefix or similarity fallback: a row that does not
// resolve to exactly one player is skipped and reported, never guessed.
// ------------------------------------------------------------
type UnmatchedReason = "no_exact_match" | "ambiguous_name" | "lookup_error";

type PlayerIdentity =
  | { id: number; reason?: undefined }
  | { id: null; reason: UnmatchedReason };

async function resolvePlayerIdentity(
  supabase: SupabaseClient,
  standardizedFullName: string,
  csvRow: Record<string, any> // its "Position" column disambiguates exact duplicates
): Promise<PlayerIdentity> {
  const { data: existingPlayers, error: selectError } = await supabase
    .from("players")
    .select("id, position")
    .eq("fullName", standardizedFullName);

  if (selectError) {
    console.error(
      `Error selecting player by fullName '${standardizedFullName}':`,
      selectError
    );
    return { id: null, reason: "lookup_error" };
  }

  if (!existingPlayers || existingPlayers.length === 0) {
    console.warn(
      `No player with exact fullName '${standardizedFullName}'. Skipping.`
    );
    return { id: null, reason: "no_exact_match" };
  }

  if (existingPlayers.length === 1) {
    return { id: existingPlayers[0].id as number };
  }

  const csvPlayerPosition = csvRow["Position"]
    ? String(csvRow["Position"]).trim().toUpperCase()
    : "";
  const csvPosSet = new Set(
    csvPlayerPosition
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  );
  const positionMatches = existingPlayers.filter((player) => {
    const pos = player.position
      ? String(player.position).trim().toUpperCase()
      : "";
    return pos && (csvPosSet.has(pos) || csvPosSet.has(pos.split("/")[0]));
  });

  if (positionMatches.length === 1) {
    return { id: positionMatches[0].id as number };
  }
  console.warn(
    `Ambiguous player name '${standardizedFullName}': ${existingPlayers.length} exact matches, CSV position '${csvPlayerPosition}'. Skipping.`
  );
  return { id: null, reason: "ambiguous_name" };
}

const UNMATCHED_LISTED_IN_MESSAGE = 10;

export default adminOnly(withCronJobAudit(
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
      const unmatchedRows: {
        row: number;
        name: string;
        reason: UnmatchedReason;
      }[] = [];
      let skippedRowCount = 0;
      for (const [rowIndex, row] of csvData.entries()) {
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

        const identity = await resolvePlayerIdentity(
          supabase,
          finalStandardizedNameForLookup,
          row
        );
        const playerId = identity.id;

        if (playerId === null) {
          unmatchedRows.push({
            row: rowIndex,
            name: standardizedFullNameFromCSV,
            reason: identity.reason
          });
          // console.warn already happens in resolvePlayerIdentity
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

      const unmatchedSummary = unmatchedRows.length
        ? ` Unmatched players (exact name required): ${unmatchedRows
            .slice(0, UNMATCHED_LISTED_IN_MESSAGE)
            .map((u) => `${u.name} (${u.reason})`)
            .join(", ")}${
            unmatchedRows.length > UNMATCHED_LISTED_IN_MESSAGE
              ? `, and ${unmatchedRows.length - UNMATCHED_LISTED_IN_MESSAGE} more`
              : ""
          }.`
        : "";

      if (dataForSupabase.length === 0 && csvData.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No data could be prepared for upsert. ${skippedRowCount} rows were skipped (missing player names or no exact player match).${unmatchedSummary}`,
          unmatchedRows
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
        message: `Successfully processed. Inserted ${dataForSupabase.length} rows into table '${tableName}'. ${skippedRowCount} CSV rows were skipped.${unmatchedSummary}`,
        unmatchedRows
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
  }));
