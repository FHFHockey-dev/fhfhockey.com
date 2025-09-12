// /Users/tim/Desktop/fhfhockey.com/web/pages/db/upsert-projections.tsx

import { ChangeEvent, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Button,
  TextField,
  Typography,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Paper,
  Box,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Card,
  CardContent,
  CardHeader
} from "@mui/material";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  standardizePlayerName,
  titleCase
} from "lib/standardization/nameStandardization"; // Adjust path
import { standardizeColumnName } from "lib/standardization/columnStandardization";
import { useSnackbar } from "notistack";
import { doPOST } from "lib/supabase"; // Your existing helper
import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";
import { useUser } from "contexts/AuthProviderContext"; // Your AuthProvider
// Optional: import name mapping JSONs produced/edited elsewhere
// These files are large but useful for consistent manual corrections across tools.
// If they don't exist, the bundler may warn; keep them optional in repo.
// @ts-ignore
import nameMappingTodo from "lib/supabase/Upserts/Yahoo/name_mapping_todo.json";

interface CSVRow {
  [key: string]: string | number;
}

interface ProcessedHeader {
  original: string;
  standardized: string;
  selected: boolean;
  dataType:
    | "TEXT"
    | "INTEGER"
    | "NUMERIC"
    | "BOOLEAN"
    | "DATE"
    | "TIMESTAMP WITH TIME ZONE"
    | "UUID";
}

// Define sets for quick lookup of typical data types based on standardized column names
const NUMERIC_COLUMNS = new Set([
  "Rank", // Assuming Rank is numeric based on your projections_cullen table
  "Goals",
  "Assists",
  "Points",
  "Plus_Minus",
  "PP_Points",
  "Penalty_Minutes",
  "Hits",
  "Blocked_Shots",
  "Shots_on_Goal",
  "Shooting_Percentage", // Store as numeric (e.g., 0.15 for 15%)
  "Game_Winning_Goals",
  "Game_Tying_Goals",
  "PP_Goals",
  "PP_Assists",
  "SH_Goals",
  "SH_Assists",
  "SH_Points",
  "Faceoff_Percentage", // Store as numeric
  "Faceoffs_Won",
  "Faceoffs_Lost",
  "Games_Started_Goalie",
  "Wins_Goalie",
  "Losses_Goalie",
  "Goals_Against_Average",
  "Save_Percentage", // Store as numeric
  "Saves_Goalie",
  "Shutouts_Goalie",
  "STP", // From Bangers
  "GP_Risk", // From Bangers
  "OFF_Rating", // From Bangers
  "BANG_Rating", // From Bangers
  "Fantasy_Points_Total", // From A&G
  "Fantasy_Points_Per_Game", // From A&G,
  "Sa", // Saves Against
  "Ga", // Goals Against
  "Games_Played", // Store as numeric (e.g., 82)
  "Otl", // Overtime Losses
  "Qs", // Quality Starts
  "Rank", // Assuming Rank is numeric based on your projections_cullen table
  "Rbs", // Rebounds
  "Games_Played", // Often text due to "Suspended", "IR", etc. and your schema uses TEXT
  "PP_TOI", // Time on ice is often M:SS string format
  "SH_TOI",
  "Time_on_Ice_Overall",
  "Time_on_Ice_Per_Game",
  "Pp_Points",
  "Vor" // Value Over Replacement Player

  // Add any other columns that are consistently numeric
]);

const TEXT_COLUMNS = new Set([
  "Player_Name",
  "Team_Abbreviation",
  "Position"

  // Add any other columns that are consistently text
]);

// INTEGER_COLUMNS could also be an option if you have clear integer-only stats
// const INTEGER_COLUMNS = new Set([
//   // e.g., "Years_Experience" if you had such a field
// ]);

export default function UpsertProjectionsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const user = useUser();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<CSVRow[]>([]);
  const [playerColumn, setPlayerColumn] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]); // Headers from the uploaded CSV
  const [processedHeaders, setProcessedHeaders] = useState<ProcessedHeader[]>(
    []
  );
  const [standardizedPreviewData, setStandardizedPreviewData] = useState<
    Record<string, any>[]
  >([]);
  const [tableName, setTableName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingPreview, setIsProcessingPreview] =
    useState<boolean>(false);

  // Heuristic matching against Yahoo names
  const [yahooCandidates, setYahooCandidates] = useState<string[]>([]);

  // Load candidate list from Supabase (prefer yahoo_names, fallback to yahoo_players)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = (await import("lib/supabase")).default;
        const { data: n1, error: e1 } = await supabase
          .from("yahoo_names")
          .select("player_name")
          .limit(5000);
        if (!cancelled && !e1 && Array.isArray(n1) && n1.length) {
          setYahooCandidates(
            n1.map((r: any) => String(r?.player_name || "")).filter(Boolean)
          );
          return;
        }
        const { data: n2, error: e2 } = await supabase
          .from("yahoo_players")
          .select("full_name")
          .limit(5000);
        if (!cancelled && !e2 && Array.isArray(n2)) {
          setYahooCandidates(
            n2.map((r: any) => String(r?.full_name || "")).filter(Boolean)
          );
        }
      } catch (err) {
        console.warn("Failed loading Yahoo candidates", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalization helpers
  const norm = useCallback(
    (s: string) =>
      (s || "")
        .toLowerCase()
        .trim()
        .replace(/[.'`-]/g, "")
        .replace(/\s+/g, " "),
    []
  );

  const splitFirstLast = useCallback((name: string) => {
    const parts = (name || "").trim().split(/\s+/);
    if (!parts.length) return ["", ""] as const;
    if (parts.length === 1) return [parts[0], parts[0]] as const;
    return [parts.slice(0, -1).join(" "), parts[parts.length - 1]] as const;
  }, []);

  const lastTokens = useCallback(
    (name: string) => {
      const [, last] = splitFirstLast(name);
      if (!last) return [] as string[];
      return last
        .split(/[-\s]+/)
        .map((t) => norm(t))
        .filter(Boolean);
    },
    [norm, splitFirstLast]
  );

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
  };

  const firstNameSimilar = useCallback(
    (a: string, b: string) => {
      const na = norm(a);
      const nb = norm(b);
      if (!na || !nb) return false;
      if (na === nb) return true;
      // common prefix similarity >= 0.5 of the longer
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
    },
    [norm]
  );

  // Build a quick lookup from the mapping JSONs: normalized unmatchedName -> correctedName
  const buildOverridesMap = useCallback(() => {
    const m: Record<string, string> = {};
    const fold = (src: any) => {
      if (!src) return;
      const entries: any[] = Array.isArray(src) ? src : Array.isArray(src?.data) ? src.data : [];
      for (const e of entries) {
        const data = e?.data ?? e;
        const u = norm(String(data?.unmatchedName || ""));
        const c = String(data?.correctedName || "");
        if (u && c) m[u] = c;
      }
    };
    try { fold(nameMappingTodo); } catch {}
    return m;
  }, [norm]);

  const nameOverridesMap = buildOverridesMap();

  const resolveByLastNameHeuristic = useCallback(
    (name: string) => {
      if (!name || !yahooCandidates.length) return "";
      const [srcFirst] = splitFirstLast(name);
      const srcLasts = lastTokens(name);
      if (!srcLasts.length) return "";
      // Only accept a candidate if BOTH last name matches and first name is a clear match
      for (const cand of yahooCandidates) {
        const [candFirst] = splitFirstLast(cand);
        const candLasts = lastTokens(cand);
        const lastExact = candLasts.some((t) => srcLasts.includes(t));
        if (!lastExact) continue; // must match last name exactly (normalized)
        const firstOK = firstNameSimilar(srcFirst, candFirst);
        if (firstOK) {
          return cand; // strong match (score === 2)
        }
      }
      // If we didn't find a strong match on first name, do NOT default to the first same-last-name.
      // Return empty to keep the original standardized name.
      return "";
    },
    [yahooCandidates, splitFirstLast, lastTokens, firstNameSimilar]
  );

  const applyNameOverridesOrHeuristic = useCallback(
    (name: string) => {
      const key = norm(name);
      const overridden = nameOverridesMap[key];
      if (overridden) return overridden;
      const h = resolveByLastNameHeuristic(name);
      return h || name;
    },
    [nameOverridesMap, norm, resolveByLastNameHeuristic]
  );

  // Redirect if not admin
  useEffect(() => {
    if (user === null) {
      // Still loading user state
      return;
    }
    if (user?.role !== "admin") {
      enqueueSnackbar("Access Denied: Admin privileges required.", {
        variant: "error"
      });
      router.push("/auth"); // Or your home page
    }
  }, [user, router, enqueueSnackbar]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        const currentFile = acceptedFiles[0];
        setFile(currentFile);
        setRawData([]);
        setCsvHeaders([]);
        setProcessedHeaders([]);
        setStandardizedPreviewData([]);
        setPlayerColumn("");
        setIsLoading(true);

        Papa.parse(currentFile, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false, // Keep everything as string initially
          complete: (results) => {
            setIsLoading(false);
            const data = results.data as CSVRow[];
            console.log(
              `[CLIENT] Papa.parse found ${data.length} rows (including potentially empty ones at end).`
            );
            // Ensure all values are strings for consistent processing initially
            const stringifiedData = data.map((row) => {
              const newRow: CSVRow = {};
              for (const key in row) {
                newRow[key] = String(row[key] ?? "");
              }
              return newRow;
            });
            setRawData(stringifiedData);

            if (results.meta.fields) {
              setCsvHeaders(results.meta.fields);
              if (results.meta.fields.length > 0) {
                // Try to intelligently pre-select player name column
                const potentialNameCols = [
                  "player",
                  "name",
                  "player name",
                  "full name"
                ];
                const foundNameCol = results.meta.fields.find((f) =>
                  potentialNameCols.includes(f.toLowerCase())
                );
                setPlayerColumn(foundNameCol || results.meta.fields[0]);
              }
            }
          },
          error: (error) => {
            setIsLoading(false);
            enqueueSnackbar(`CSV Parsing Error: ${error.message}`, {
              variant: "error"
            });
          }
        });
      }
    },
    [enqueueSnackbar]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false
  });

  const handleProcessPreview = () => {
    if (!rawData.length || !playerColumn) {
      enqueueSnackbar(
        "Please upload a CSV and select the player name column.",
        { variant: "warning" }
      );
      return;
    }
    setIsProcessingPreview(true);

    const newProcessedHeaders = csvHeaders.map((h) => {
      const standardizedName = standardizeColumnName(h);
      let defaultDataType: ProcessedHeader["dataType"] = "TEXT"; // Default to TEXT

      if (NUMERIC_COLUMNS.has(standardizedName)) {
        defaultDataType = "NUMERIC";
      } else if (TEXT_COLUMNS.has(standardizedName)) {
        defaultDataType = "TEXT";
      }
      // Add more conditions here if needed, e.g., for INTEGER_COLUMNS

      // Specifically ensure the column chosen as playerColumn (standardized to Player_Name) is TEXT
      // This is redundant if Player_Name is in TEXT_COLUMNS but good for clarity.
      if (standardizedName === "Player_Name") {
        defaultDataType = "TEXT";
      }

      return {
        original: h,
        standardized: standardizedName,
        selected: true, // Select all columns by default
        dataType: defaultDataType
      };
    });
    setProcessedHeaders(newProcessedHeaders);

    const currentStandardizedData = rawData.slice(0, 20).map((row) => {
      // Preview first 20 rows
      const standardizedRow: Record<string, any> = {};
      for (const headerConfig of newProcessedHeaders) {
        const originalValue = String(row[headerConfig.original] || "");
        // When preparing preview data, the player name from the selected CSV column
        // (identified by headerConfig.original === playerColumn)
        // is standardized for display under its new standardized column name.
        if (headerConfig.original === playerColumn) {
          const std = standardizePlayerName(originalValue);
          standardizedRow[headerConfig.standardized] = applyNameOverridesOrHeuristic(std);
        } else {
          standardizedRow[headerConfig.standardized] = originalValue;
        }
      }
      return standardizedRow;
    });
    setStandardizedPreviewData(currentStandardizedData);
    setIsProcessingPreview(false);
  };

  const handleHeaderToggle = (index: number) => {
    setProcessedHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, selected: !h.selected } : h))
    );
  };

  const handleHeaderNameChange = (index: number, newName: string) => {
    setProcessedHeaders((prev) =>
      prev.map((h, i) =>
        i === index
          ? { ...h, standardized: newName.replace(/[^a-zA-Z0-9_]/g, "_") }
          : h
      )
    );
  };

  const handleHeaderTypeChange = (
    index: number,
    newType: ProcessedHeader["dataType"]
  ) => {
    setProcessedHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, dataType: newType } : h))
    );
  };

  const handleAddNewColumn = () => {
    const newColName = prompt(
      "Enter new standardized column name (e.g., Notes). It will be TEXT type by default."
    );
    if (newColName) {
      const standardizedNewName = newColName.replace(/[^a-zA-Z0-9_]/g, "_");
      if (
        !processedHeaders.find((h) => h.standardized === standardizedNewName)
      ) {
        setProcessedHeaders((prev) => [
          ...prev,
          {
            original: `custom_${standardizedNewName}`,
            standardized: standardizedNewName,
            selected: true,
            dataType: "TEXT"
          }
        ]);
      } else {
        enqueueSnackbar(
          "A column with that standardized name already exists or was proposed.",
          { variant: "warning" }
        );
      }
    }
  };

  const handleUpsert = async () => {
    if (
      !rawData.length ||
      !tableName.trim() ||
      !processedHeaders.find((h) => h.selected) ||
      !playerColumn
    ) {
      enqueueSnackbar(
        "File, player column, table name, and selected columns are required.",
        { variant: "warning" }
      );
      return;
    }

    setIsLoading(true);

    const finalColumnsToUpsert = processedHeaders.filter((h) => h.selected);
    console.log(
      `[CLIENT] rawData.length before map in handleUpsert: ${rawData.length}`
    );

    const dataToUpsert = rawData.map((row) => {
      const upsertRow: Record<string, any> = {};
      let playerNameStandardized = false;
      // Ensure the selected player column's standardized name is used for player data
      const selectedPlayerColConfig = finalColumnsToUpsert.find(
        (h) => h.original === playerColumn
      );

      for (const colDef of finalColumnsToUpsert) {
        const originalValue = String(row[colDef.original] ?? ""); // Use ?? '' for undefined/null
        if (colDef.original === playerColumn) {
          const std = standardizePlayerName(originalValue);
          upsertRow[colDef.standardized] = applyNameOverridesOrHeuristic(std);
          playerNameStandardized = true;
        } else {
          upsertRow[colDef.standardized] = originalValue;
        }
      }
      // If the player column was de-selected but was the source, this would be an issue.
      // The logic assumes if `playerColumn` is set, its config will be found if selected.
      if (!playerNameStandardized && selectedPlayerColConfig) {
        const std = standardizePlayerName(String(row[playerColumn] || ""));
        upsertRow[selectedPlayerColConfig.standardized] = applyNameOverridesOrHeuristic(std);
      }
      return upsertRow;
    });

    const playerIdentifierColumnConfig = finalColumnsToUpsert.find(
      (c) => c.original === playerColumn
    );
    if (!playerIdentifierColumnConfig) {
      enqueueSnackbar(
        "The selected player name column is not included in the columns to upsert. Please select it.",
        { variant: "error" }
      );
      setIsLoading(false);
      return;
    }

    console.log(
      `[CLIENT] dataToUpsert.length (payload.csvData): ${dataToUpsert.length}`
    );

    const payload = {
      tableName: tableName.trim(),
      columns: finalColumnsToUpsert.map((h) => ({
        name: h.standardized,
        type: h.dataType,
        isPlayerNameSource: h.original === playerColumn
      })),
      csvData: dataToUpsert,
      playerIdentifierColumnName: playerIdentifierColumnConfig.standardized
    };

    try {
      const { message, success } = await doPOST(
        // /Users/tim/Desktop/fhfhockey.com/web/pages/api/v1/db/upsert-csv.ts

        "/api/v1/db/upsert-csv",
        payload
      );
      enqueueSnackbar(message, { variant: success ? "success" : "error" });
      if (success) {
        // Optionally reset form
        setFile(null);
        setRawData([]);
        setCsvHeaders([]);
        setProcessedHeaders([]);
        setStandardizedPreviewData([]);
        setPlayerColumn("");
        setTableName("");
      }
    } catch (e: any) {
      enqueueSnackbar(e.message || "Failed to upsert data.", {
        variant: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (user && user.role !== "admin") {
    return (
      <Container>
        <PageTitle>Access Denied</PageTitle>
        <Typography>You do not have permission to view this page.</Typography>
        <Link href="/" passHref legacyBehavior>
          <Button variant="contained">Go Home</Button>
        </Link>
      </Container>
    );
  }
  if (!user) {
    // Still loading or not logged in
    return (
      <Container>
        <PageTitle>Loading...</PageTitle>
        <Box sx={{ display: "flex", justifyContent: "center", padding: 3 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle>Admin: Upsert CSV Projections</PageTitle>
      <ClientOnly>
        {" "}
        {/* Ensures this only renders on client after auth check */}
        <Paper elevation={3} sx={{ padding: 3, marginY: 2 }}>
          <Typography variant="h5" gutterBottom sx={{ marginBottom: 2 }}>
            1. Upload CSV File
          </Typography>
          <Box
            {...getRootProps()}
            sx={{
              border: "2px dashed grey",
              padding: 4,
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 2,
              backgroundColor: isDragActive ? "#e3f2fd" : "transparent"
            }}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the CSV file here ...</p>
            ) : (
              <p>
                Drag &aposn&apos drop a CSV file here, or click to select file
              </p>
            )}
            {file && (
              <Typography sx={{ marginTop: 1 }}>
                Selected file: {file.name}
              </Typography>
            )}
          </Box>
          {isLoading && !file && <CircularProgress size={24} />}
        </Paper>
        {csvHeaders.length > 0 && (
          <Paper elevation={3} sx={{ padding: 3, marginY: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ marginBottom: 2 }}>
              2. Configure Source & Process
            </Typography>
            <FormControl fullWidth margin="normal" variant="outlined">
              <InputLabel id="player-column-select-label">
                Player Name Column (from CSV)
              </InputLabel>
              <Select
                labelId="player-column-select-label"
                label="Player Name Column (from CSV)"
                value={playerColumn}
                onChange={(e) => setPlayerColumn(e.target.value as string)}
              >
                {csvHeaders.map((h) => (
                  <MenuItem key={h} value={h}>
                    {h}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleProcessPreview}
              disabled={!playerColumn || isProcessingPreview || !rawData.length}
              sx={{ marginTop: 1, marginBottom: 2 }}
            >
              {isProcessingPreview ? (
                <CircularProgress size={24} />
              ) : (
                "Process & Preview Headers/Data"
              )}
            </Button>
          </Paper>
        )}
        {processedHeaders.length > 0 && (
          <Paper elevation={3} sx={{ padding: 3, marginY: 2 }}>
            <Typography variant="h5" gutterBottom>
              3. Define Supabase Table Schema
            </Typography>
            <Typography
              variant="subtitle2"
              color="textSecondary"
              sx={{ marginBottom: 2 }}
            >
              Select columns to include, their standardized names, and data
              types for the new Supabase table.
            </Typography>
            <FormGroup>
              {processedHeaders.map((header, index) => (
                <Card
                  key={`${header.original}-${index}`}
                  variant="outlined"
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: "center",
                    gap: 1,
                    marginBottom: 1.5,
                    padding: 1.5
                  }}
                >
                  <Checkbox
                    checked={header.selected}
                    onChange={() => handleHeaderToggle(index)}
                    sx={{ padding: "0 8px 0 0" }}
                  />
                  <TextField
                    label="Original CSV Header"
                    value={header.original}
                    size="small"
                    InputProps={{ readOnly: true }}
                    sx={{ flexGrow: 1, minWidth: "150px" }}
                  />
                  <TextField
                    label="Standardized DB Column Name"
                    value={header.standardized}
                    size="small"
                    onChange={(e) =>
                      handleHeaderNameChange(index, e.target.value)
                    }
                    sx={{ flexGrow: 1.5, minWidth: "200px" }}
                  />
                  <FormControl
                    size="small"
                    sx={{ flexGrow: 1, minWidth: "150px" }}
                  >
                    <InputLabel id={`data-type-label-${index}`}>
                      Data Type
                    </InputLabel>
                    <Select
                      labelId={`data-type-label-${index}`}
                      label="Data Type"
                      value={header.dataType}
                      onChange={(e) =>
                        handleHeaderTypeChange(
                          index,
                          e.target.value as ProcessedHeader["dataType"]
                        )
                      }
                    >
                      <MenuItem value="TEXT">TEXT</MenuItem>
                      <MenuItem value="INTEGER">INTEGER</MenuItem>
                      <MenuItem value="NUMERIC">NUMERIC</MenuItem>
                      <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                      <MenuItem value="DATE">DATE</MenuItem>
                      <MenuItem value="TIMESTAMP WITH TIME ZONE">
                        TIMESTAMP WITH TIME ZONE
                      </MenuItem>
                      <MenuItem value="UUID">UUID</MenuItem>
                    </Select>
                  </FormControl>
                </Card>
              ))}
            </FormGroup>
            <Button
              size="small"
              onClick={handleAddNewColumn}
              sx={{ marginTop: 1 }}
            >
              + Add Custom Column (as TEXT)
            </Button>

            <Typography variant="h6" sx={{ marginTop: 3, marginBottom: 1 }}>
              Supabase Table Name
            </Typography>
            <TextField
              label="New Table Name (e.g., projections_2024_bangers)"
              variant="outlined"
              fullWidth
              value={tableName}
              onChange={(e) =>
                setTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
              }
              helperText="Must be 3-63 chars, start with letter/underscore, use letters, numbers, underscores."
            />
          </Paper>
        )}
        {standardizedPreviewData.length > 0 && processedHeaders.length > 0 && (
          <Paper elevation={3} sx={{ padding: 3, marginY: 2 }}>
            <Typography variant="h5" gutterBottom>
              4. Preview Standardized Data (First{" "}
              {standardizedPreviewData.length} Rows)
            </Typography>
            <Typography
              variant="subtitle2"
              color="textSecondary"
              sx={{ marginBottom: 2 }}
            >
              Only selected columns with their standardized names are shown
              below.
            </Typography>
            <Box
              sx={{
                maxHeight: "400px",
                overflow: "auto",
                background: "#f0f0f0",
                padding: 1,
                border: "1px solid #ccc",
                borderRadius: "4px"
              }}
            >
              <table>
                <thead>
                  <tr>
                    {processedHeaders
                      .filter((h) => h.selected)
                      .map((h) => (
                        <th
                          key={h.standardized}
                          style={{
                            padding: "4px 8px",
                            textAlign: "left",
                            borderBottom: "1px solid #ddd"
                          }}
                        >
                          {h.standardized}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {standardizedPreviewData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {processedHeaders
                        .filter((h) => h.selected)
                        .map((h) => (
                          <td
                            key={`${h.standardized}-${rowIndex}`}
                            style={{
                              padding: "4px 8px",
                              borderBottom: "1px solid #eee"
                            }}
                          >
                            {String(row[h.standardized] ?? "")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        )}
        {tableName &&
          processedHeaders.some((h) => h.selected) &&
          rawData.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpsert}
              disabled={isLoading}
              size="large"
              sx={{ marginTop: 2, paddingY: 1.5 }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                `Upsert to Supabase Table: "${tableName}"`
              )}
            </Button>
          )}
      </ClientOnly>
    </Container>
  );
}
