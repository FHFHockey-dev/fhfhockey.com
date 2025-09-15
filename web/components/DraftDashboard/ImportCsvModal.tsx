import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import {
  standardizePlayerName,
  titleCase
} from "../../lib/standardization/nameStandardization";
import supabase from "lib/supabase";
import { standardizeColumnName } from "../../lib/standardization/columnStandardization";

export type CsvPreviewRow = Record<string, string | number | null>;

type HeaderConfig = {
  original: string;
  standardized: string;
  selected: boolean;
};

const REQUIRED_COLUMNS = [
  "Player_Name",
  "Team_Abbreviation",
  "Position",
  "Goals",
  "Assists"
];

const SESSION_KEY = "draft.customCsv.v1" as const;

// Normalization helper: lower-case, strip punctuation (periods, apostrophes, dashes), remove accents
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ImportCsvModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (args: {
    headers: HeaderConfig[];
    rows: CsvPreviewRow[];
    sourceId: string;
    label: string;
  }) => void;
};

export default function ImportCsvModal({
  open,
  onClose,
  onImported
}: ImportCsvModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [allRows, setAllRows] = useState<CsvPreviewRow[]>([]);
  const [rawRows, setRawRows] = useState<CsvPreviewRow[]>([]); // preview (first 50)
  const [headers, setHeaders] = useState<HeaderConfig[]>([]);
  const [playerHeader, setPlayerHeader] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [sourceName, setSourceName] = useState("Custom CSV"); // Default name
  const [dbPlayers, setDbPlayers] = useState<
    Array<{
      id: number;
      fullName: string;
      position: string | null;
      lastName?: string | null;
    }>
  >([]);
  const [ambiguousChoices, setAmbiguousChoices] = useState<
    Record<string, number | "">
  >({}); // key: standardized name in preview, val: selected player id
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [searchInputs, setSearchInputs] = useState<Record<string, string>>({});
  const [forceImportDespiteUnresolved, setForceImportDespiteUnresolved] =
    useState(false);
  const loggedTargetsRef = useRef(false);

  const focusFirst = useCallback(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables[0]?.focus();
  }, []);

  useEffect(() => {
    if (open) {
      // focus trap start
      setTimeout(focusFirst, 0);
      // Fetch players list for disambiguation (paginated to bypass row limits)
      (async () => {
        try {
          const pageSize = 1000;
          let from = 0;
          let all: any[] = [];
          while (true) {
            const { data, error } = await supabase
              .from("players")
              .select("id, fullName, position, lastName")
              .range(from, from + pageSize - 1);
            if (error) break;
            if (!data || !data.length) break;
            all = all.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
            if (from > 50000) break; // safety cap
          }
          if (all.length) {
            setDbPlayers(
              all.map((r: any) => ({
                id: Number(r.id),
                fullName: String(r.fullName),
                position: (r as any).position ?? null,
                lastName: (r as any).lastName ?? null
              }))
            );
            try {
              console.log(
                `[ImportCsvModal] Loaded players count: ${all.length}`
              );
            } catch {}
            // Targeted presence logging for specific players of interest
            const targets = [
              "Leo Carlsson",
              "Adam Larsson",
              "Cutter Gauthier",
              "J.T. Miller",
              "K'Andre Miller"
            ];
            targets.forEach((t) => {
              const matches = all.filter(
                (p: any) => String(p.fullName).toLowerCase() === t.toLowerCase()
              );
              if (matches.length) {
                console.log(
                  `[ImportCsvModal] Target player present in DB fetch: ${t} -> IDs: ${matches.map((m: any) => m.id).join(", ")}`
                );
              } else {
                console.log(
                  `[ImportCsvModal] Target player NOT found in DB fetch: ${t}`
                );
              }
            });
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [open, focusFirst]);

  // After CSV parsing, fetch any players whose last names appear in the CSV but are missing from initial dbPlayers fetch (safety if table large or access restricted).
  useEffect(() => {
    if (!open) return;
    if (!dbPlayers.length) return; // wait for initial load
    if (!allRows.length && !rawRows.length) return; // nothing parsed yet
    const source = allRows.length ? allRows : rawRows;
    const csvLastNames = new Set<string>();
    source.forEach((row: any) => {
      const name = playerHeader
        ? row[playerHeader]
        : row.Player_Name || row.player_name || row.name;
      if (!name) return;
      const parts = String(name).trim().split(/\s+/);
      if (parts.length) csvLastNames.add(parts[parts.length - 1]);
    });
    if (!csvLastNames.size) return;
    const have = new Set(
      dbPlayers.map((p) =>
        (p.lastName || p.fullName.split(" ").slice(-1)[0]).toLowerCase()
      )
    );
    const missing = Array.from(csvLastNames).filter(
      (ln) => !have.has(ln.toLowerCase())
    );
    if (!missing.length) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("id, fullName, position, lastName")
          .in("lastName", missing);
        if (!error && Array.isArray(data) && data.length) {
          setDbPlayers((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const extra = data
              .filter((r: any) => !seen.has(Number(r.id)))
              .map((r: any) => ({
                id: Number(r.id),
                fullName: String(r.fullName),
                position: (r as any).position ?? null,
                lastName: (r as any).lastName ?? null
              }));
            return extra.length ? [...prev, ...extra] : prev;
          });
          try {
            console.log(
              `[ImportCsvModal] Secondary fetch added ${data.length} players (after last-name scan)`
            );
          } catch {}
        }
      } catch {
        // swallow
      }
    })();
  }, [open, allRows, rawRows, dbPlayers, playerHeader]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const el = dialogRef.current;
        if (!el) return;
        const focusables = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    const file = acceptedFiles[0];
    if (!file) return;
    setIsParsing(true);
    Papa.parse<CsvPreviewRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const data = (result.data || []).filter(Boolean);
        if (!data.length) {
          setError("No rows found in CSV.");
          setIsParsing(false);
          return;
        }
        // Build headers map
        const firstRow = data[0] as Record<string, any>;
        const incomingHeaders = Object.keys(firstRow);
        const processed = incomingHeaders.map((h) => ({
          original: h,
          standardized: standardizeColumnName(h),
          selected: true
        }));
        setHeaders(processed);
        // Guess player column
        const guess =
          processed.find((h) => h.standardized === "Player_Name")?.original ||
          null;
        setPlayerHeader(guess);
        setAllRows(data as CsvPreviewRow[]);
        setRawRows(data.slice(0, 50));
        setIsParsing(false);
      },
      error: (err) => {
        setError(err.message || "Failed to parse CSV");
        setIsParsing(false);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "text/csv": [".csv"] }
  });

  const mappedPreview = useMemo(() => {
    if (!rawRows.length || !headers.length) return [] as CsvPreviewRow[];
    const selected = headers.filter((h) => h.selected);
    return rawRows.map((row) => {
      const out: CsvPreviewRow = {};
      for (const h of selected) {
        const v = row[h.original];
        if (playerHeader && h.original === playerHeader) {
          out[h.standardized] = standardizePlayerName(String(v ?? ""));
        } else {
          out[h.standardized] = v as any;
        }
      }
      return out;
    });
  }, [rawRows, headers, playerHeader]);

  // Full mapped dataset (entire CSV) used for ambiguity detection; preview remains limited to first 50 for UI.
  const mappedAllRows = useMemo(() => {
    const source = allRows.length ? allRows : rawRows;
    if (!source.length || !headers.length) return [] as CsvPreviewRow[];
    const selected = headers.filter((h) => h.selected);
    return source.map((row) => {
      const out: CsvPreviewRow = {};
      for (const h of selected) {
        const v = (row as any)[h.original];
        if (playerHeader && h.original === playerHeader) {
          out[h.standardized] = standardizePlayerName(String(v ?? ""));
        } else {
          out[h.standardized] = v as any;
        }
      }
      return out;
    });
  }, [allRows, rawRows, headers, playerHeader]);

  // Build ambiguities for preview rows: if standardized Player_Name matches multiple DB players by last name
  const previewAmbiguities = useMemo(() => {
    const list: Array<{
      key: string;
      candidates: Array<{
        id: number;
        fullName: string;
        position: string | null;
        teamAbbrev: string | null;
      }>;
      csvTeam?: string | null;
      csvPos?: string | null;
    }> = [];
    const seen = new Set<string>();
    // Use full dataset so ambiguity resolution covers entire CSV, not just first 50 preview rows.
    mappedAllRows.forEach((row) => {
      const name = String((row as any).Player_Name || "");
      if (!name) return;
      const csvTeam = (row as any).Team_Abbreviation || null;
      const csvPos = (row as any).Position || null;
      const tokens = name.split(/\s+/);
      const last = tokens.length > 1 ? tokens[tokens.length - 1] : name;
      let cands = dbPlayers.filter(
        (p) =>
          p.fullName.split(" ").slice(-1)[0].toLowerCase() ===
          last.toLowerCase()
      );
      // Ensure exact full-name match is included at front if found but not already in cands
      const exact = dbPlayers.find(
        (p) => p.fullName.toLowerCase() === name.toLowerCase()
      );
      if (exact && !cands.some((c) => c.id === exact.id)) {
        cands = [exact, ...cands];
      }
      if (cands.length > 1 && !seen.has(name)) {
        seen.add(name);
        list.push({
          key: name,
          candidates: cands.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            position: c.position ?? null,
            teamAbbrev: (c as any).teamAbbrev ?? null
          })),
          csvTeam,
          csvPos
        });
      }
    });
    return list;
  }, [mappedAllRows, dbPlayers]);

  // Auto-populate ambiguousChoices with exact single matches (unique fullName in DB)
  useEffect(() => {
    if (!mappedAllRows.length || !dbPlayers.length) return;
    const exactMap = new Map<string, number[]>(); // raw lowercase → ids
    const normalizedMap = new Map<string, number[]>(); // normalized → ids
    dbPlayers.forEach((p) => {
      const rawKey = p.fullName.toLowerCase();
      if (!exactMap.has(rawKey)) exactMap.set(rawKey, []);
      exactMap.get(rawKey)!.push(p.id);
      const normKey = normalizeForMatch(p.fullName);
      if (!normalizedMap.has(normKey)) normalizedMap.set(normKey, []);
      normalizedMap.get(normKey)!.push(p.id);
    });
    setAmbiguousChoices((prev) => {
      const next = { ...prev };
      mappedAllRows.forEach((row: any) => {
        const nm = String((row as any).Player_Name || "").trim();
        if (!nm || next[nm]) return;
        const rawIds = exactMap.get(nm.toLowerCase());
        if (rawIds && rawIds.length === 1) {
          next[nm] = rawIds[0];
          return;
        }
        // Normalized pass (handles punctuation / accents: J.T. → JT, K'Andre → k andre → k andre)
        const norm = normalizeForMatch(nm);
        const normIds = normalizedMap.get(norm);
        if (normIds && normIds.length === 1) {
          next[nm] = normIds[0];
        }
      });
      return next;
    });
  }, [mappedAllRows, dbPlayers]);

  // ---------- Fuzzy Matching Helpers ----------
  const levenshtein = useCallback((a: string, b: string) => {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }, []);

  const ambiguousWithSuggestions = useMemo(() => {
    if (!previewAmbiguities.length)
      return [] as Array<{
        key: string;
        candidates: {
          id: number;
          fullName: string;
          score: number;
          position: string | null;
          teamAbbrev: string | null;
        }[];
        best?: {
          id: number;
          fullName: string;
          score: number;
          position: string | null;
          teamAbbrev: string | null;
        } | null;
      }>;
    return previewAmbiguities.map((a) => {
      const scored = a.candidates
        .map((c) => {
          const dist = levenshtein(a.key, c.fullName);
          const maxLen = Math.max(a.key.length, c.fullName.length) || 1;
          const score = 1 - dist / maxLen; // 1 = perfect
          return {
            id: c.id,
            fullName: c.fullName,
            position: (c as any).position ?? null,
            teamAbbrev: (c as any).teamAbbrev ?? null,
            score
          };
        })
        .sort((x, y) => y.score - x.score);
      const best = scored[0];
      return { key: a.key, candidates: scored, best };
    });
  }, [previewAmbiguities, levenshtein]);

  // Debug: log missing teamAbbrev counts once after suggestions built
  useEffect(() => {
    if (!ambiguousWithSuggestions.length) return;
    try {
      const total = ambiguousWithSuggestions.reduce(
        (acc, r) => acc + r.candidates.length,
        0
      );
      const missing = ambiguousWithSuggestions.reduce(
        (acc, r) =>
          acc + r.candidates.filter((c) => !c.teamAbbrev).length,
        0
      );
      console.log(
        `[ImportCsvModal] Ambiguity candidates: ${total}, missing teamAbbrev: ${missing}`
      );
    } catch {}
  }, [ambiguousWithSuggestions]);

  // Auto resolve perfect unique matches among ambiguous candidates (only if exactly one perfect score)
  useEffect(() => {
    setAmbiguousChoices((prev) => {
      const next = { ...prev };
      ambiguousWithSuggestions.forEach((r) => {
        if (next[r.key]) return;
        const perfect = r.candidates.filter((c) => c.score === 1);
        if (perfect.length === 1) next[r.key] = perfect[0].id;
      });
      return next;
    });
  }, [ambiguousWithSuggestions]);

  const missingRequired = useMemo(() => {
    const set = new Set(
      headers.filter((h) => h.selected).map((h) => h.standardized)
    );
    return REQUIRED_COLUMNS.filter((r) => !set.has(r));
  }, [headers]);

  const mapRows = (rows: CsvPreviewRow[]) => {
    const selected = headers.filter((h) => h.selected);
    return rows.map((row) => {
      const out: CsvPreviewRow = {};
      let stdName = "";
      for (const h of selected) {
        const v = row[h.original];
        if (playerHeader && h.original === playerHeader) {
          stdName = standardizePlayerName(String(v ?? ""));
          out[h.standardized] = stdName;
        } else {
          out[h.standardized] = v as any;
        }
      }
      // If user selected a specific player for this standardized name, attach player_id
      const sel = ambiguousChoices[stdName];
      if (sel && typeof sel === "number") {
        (out as any).player_id = sel;
      } else if (!sel && stdName) {
        // Attempt exact match by full name
        const exact = dbPlayers.filter(
          (p) => p.fullName.toLowerCase() === stdName.toLowerCase()
        );
        if (exact.length === 1) {
          (out as any).player_id = exact[0].id;
        } else {
          // Fallback: unique last name
          const parts = stdName.split(/\s+/);
          const last = parts[parts.length - 1].toLowerCase();
          const lastMatches = dbPlayers.filter(
            (p) => p.fullName.split(" ").slice(-1)[0].toLowerCase() === last
          );
          if (lastMatches.length === 1) {
            (out as any).player_id = lastMatches[0].id;
          }
        }
      }
      return out;
    });
  };

  const handleConfirm = () => {
    if (missingRequired.length) {
      setError(`Missing required columns: ${missingRequired.join(", ")}`);
      return;
    }
    // Unresolved ambiguous names guard
    if (unresolvedCount > 0 && !forceImportDespiteUnresolved) {
      setError(
        `There are still ${unresolvedCount} unresolved ambiguous name(s). Resolve or force import.`
      );
      return;
    }
    const mapped = mapRows(allRows.length ? allRows : rawRows);
    const unmapped = mapped.filter(
      (r) => (r as any).Player_Name && !(r as any).player_id
    );
    if (unmapped.length > 0 && !forceImportDespiteUnresolved) {
      setError(
        `Detected ${unmapped.length} row(s) without player_id. Review or force import.`
      );
      return;
    }
    const payload = {
      headers,
      rows: mapped,
      sourceId: "custom_csv",
      label: sourceName
    } as const;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ headers, rows: payload.rows, label: sourceName })
      );
    } catch {}
    onImported(payload);
    onClose();
  };

  const handleHeaderToggle = (idx: number) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, selected: !h.selected } : h))
    );
  };

  const handleHeaderNameChange = (idx: number, value: string) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, standardized: value } : h))
    );
  };

  // ---- Derived hook values (must be before any early returns to preserve hook order) ----
  // Count unresolved ambiguous names
  const unresolvedCount = useMemo(
    () =>
      ambiguousWithSuggestions.filter((r) => !ambiguousChoices[r.key]).length,
    [ambiguousWithSuggestions, ambiguousChoices]
  );

  // Live mapped rows & unmapped count (for banner guard) – lightweight derivation
  const liveMappedRows = useMemo(
    () => mapRows(allRows.length ? allRows : rawRows),
    [allRows, rawRows, ambiguousChoices, dbPlayers, headers, playerHeader]
  );
  const liveUnmapped = useMemo(
    () =>
      liveMappedRows.filter(
        (r) => (r as any).Player_Name && !(r as any).player_id
      ),
    [liveMappedRows]
  );

  // One-time targeted mapping logging
  useEffect(() => {
    if (loggedTargetsRef.current) return;
    if (!liveMappedRows.length) return;
    const targets = ["Leo Carlsson", "Adam Larsson", "Cutter Gauthier"];
    targets.forEach((t) => {
      const row = liveMappedRows.find(
        (r) =>
          String((r as any).Player_Name || "").toLowerCase() === t.toLowerCase()
      );
      if (row) {
        console.log(
          `[ImportCsvModal] Mapping status for ${t}: player_id=${(row as any).player_id || "NONE"}`
        );
      } else {
        console.log(`[ImportCsvModal] CSV row not found for target name: ${t}`);
      }
    });
    loggedTargetsRef.current = true;
  }, [liveMappedRows]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-csv-title"
      className="importCsvModalBackdrop"
      style={backdropStyle}
    >
      <div ref={dialogRef} className="importCsvModal" style={modalStyle}>
        <div className="modalHeader" style={headerStyle}>
          <h2 id="import-csv-title" style={{ margin: 0 }}>
            Import Projections (CSV)
          </h2>
          <button onClick={onClose} aria-label="Close" style={buttonStyle}>
            ×
          </button>
        </div>
        <div
          {...getRootProps()}
          style={{
            ...dropzoneStyle,
            borderColor: isDragActive ? "#4caf50" : "#888"
          }}
          aria-label="CSV Dropzone"
        >
          <input {...getInputProps()} aria-label="CSV File Input" />
          {isDragActive ? (
            <p>Drop the CSV here…</p>
          ) : (
            <p>Drag and drop a CSV here, or click to browse</p>
          )}
        </div>
        {isParsing && <p>Parsing…</p>}
        {error && (
          <p role="alert" style={{ color: "#d32f2f" }}>
            {error}
          </p>
        )}

        {headers.length > 0 && (
          <div style={{ maxHeight: 320, overflow: "auto", marginTop: 12 }}>
            <h3 style={{ margin: "8px 0" }}>Header mapping</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Include</th>
                  <th align="left">Original</th>
                  <th align="left">Standardized</th>
                  <th align="left">Player Column</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, idx) => (
                  <tr key={h.original}>
                    <td>
                      <input
                        type="checkbox"
                        checked={h.selected}
                        onChange={() => handleHeaderToggle(idx)}
                        aria-label={`Toggle include ${h.original}`}
                      />
                    </td>
                    <td>{h.original}</td>
                    <td>
                      <input
                        type="text"
                        value={h.standardized}
                        onChange={(e) =>
                          handleHeaderNameChange(
                            idx,
                            titleCase(e.target.value.replace(/\s+/g, "_"))
                          )
                        }
                        aria-label={`Standardized name for ${h.original}`}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="radio"
                        name="playerColumn"
                        checked={playerHeader === h.original}
                        onChange={() => setPlayerHeader(h.original)}
                        aria-label={`Set ${h.original} as player column`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missingRequired.length > 0 && (
              <p style={{ color: "#d32f2f" }}>
                Missing required: {missingRequired.join(", ")}
              </p>
            )}

            <h3 style={{ margin: "12px 0 4px" }}>Preview (first 50 rows)</h3>
            <div
              style={{
                maxHeight: 200,
                overflow: "auto",
                border: "1px solid #ddd"
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {headers
                      .filter((h) => h.selected)
                      .map((h) => (
                        <th
                          key={h.original}
                          style={{ borderBottom: "1px solid #ccc" }}
                        >
                          {h.standardized}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i}>
                      {headers
                        .filter((h) => h.selected)
                        .map((h) => (
                          <td
                            key={h.original}
                            style={{ borderBottom: "1px solid #eee" }}
                          >
                            {String(row[h.standardized] ?? "")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ambiguousWithSuggestions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ margin: "8px 0" }}>Resolve Ambiguous Names</h3>
            <p style={{ opacity: 0.8, marginTop: 0 }}>
              We auto-resolve perfect unique matches. Accept or override others
              below. Use search if needed.
            </p>
            {/* Auto-resolved list */}
            {ambiguousWithSuggestions.some((r) => ambiguousChoices[r.key]) && (
              <div style={{ marginBottom: 12 }}>
                <strong>Auto-Resolved</strong>
                <ul
                  style={{
                    margin: "4px 0 0",
                    paddingLeft: 18,
                    maxHeight: 100,
                    overflowY: "auto"
                  }}
                >
                  {ambiguousWithSuggestions
                    .filter((r) => ambiguousChoices[r.key])
                    .map((r) => {
                      const id = ambiguousChoices[r.key];
                      const cand = r.candidates.find((c) => c.id === id);
                      if (!cand) return null;
                      return (
                        <li key={r.key} style={{ fontSize: 12 }}>
                          {r.key} → {cand.fullName}{" "}
                          <span
                            style={{
                              background: "#2e7d32",
                              color: "#fff",
                              padding: "1px 6px",
                              borderRadius: 10,
                              fontSize: 10
                            }}
                          >
                            auto
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            <div
              style={{
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: 4,
                borderTop: "1px solid #333",
                paddingTop: 8
              }}
            >
              {ambiguousWithSuggestions
                .filter((r) => !ambiguousChoices[r.key])
                .map((r) => {
                  const csvMeta = (() => {
                    const raw = previewAmbiguities.find((p) => p.key === r.key);
                    const t = raw?.csvTeam || "CSV?";
                    const p = raw?.csvPos || "?";
                    return ` (${t} ${p})`;
                  })();
                  const suggestion = r.best;
                  const rejected = rejectedSuggestions.has(r.key);
                  const search = searchInputs[r.key] || "";
                  const dynamicMatches = search
                    ? dbPlayers
                        .filter((p) => {
                          const q = search.toLowerCase();
                          return p.fullName.toLowerCase().includes(q);
                        })
                        .slice(0, 25)
                    : [];
                  return (
                    <div
                      key={r.key}
                      style={{
                        marginBottom: 12,
                        background: "rgba(255,255,255,0.04)",
                        padding: 8,
                        borderRadius: 6
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          justifyContent: "space-between"
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {r.key}
                          <span style={{ opacity: 0.6 }}>{csvMeta}</span>
                        </div>
                        {!rejected && suggestion && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center"
                            }}
                          >
                            <span style={{ fontSize: 12, opacity: 0.85 }}>
                              {(() => {
                                const team = suggestion.teamAbbrev || "??";
                                const pos = suggestion.position || "?";
                                return `Suggest: ${suggestion.fullName} (${team} ${pos}) ${(suggestion.score * 100).toFixed(1)}%`;
                              })()}
                            </span>
                            <button
                              onClick={() =>
                                setAmbiguousChoices((prev) => ({
                                  ...prev,
                                  [r.key]: suggestion.id
                                }))
                              }
                              style={smallPrimaryBtn}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() =>
                                setRejectedSuggestions(
                                  (s) => new Set([...Array.from(s), r.key])
                                )
                              }
                              style={smallSecondaryBtn}
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                      {rejected && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap"
                          }}
                        >
                          <select
                            value={ambiguousChoices[r.key] ?? ""}
                            onChange={(e) =>
                              setAmbiguousChoices((prev) => ({
                                ...prev,
                                [r.key]: e.target.value
                                  ? Number(e.target.value)
                                  : ""
                              }))
                            }
                            style={{ minWidth: 260 }}
                          >
                            <option value="">Select player…</option>
                            {r.candidates.map((c) => {
                              // fallback to CSV context if no teamAbbrev / position
                              const csvCtx = previewAmbiguities.find(
                                (p) => p.key === r.key
                              );
                              const team = c.teamAbbrev || csvCtx?.csvTeam || "??";
                              const pos = c.position || csvCtx?.csvPos || "?";
                              return (
                                <option key={c.id} value={c.id}>
                                  {c.fullName} ({team} {pos}) {(c.score * 100).toFixed(0)}%
                                </option>
                              );
                            })}
                            {dynamicMatches.length > 0 && (
                              <option disabled>-- Search Results --</option>
                            )}
                            {dynamicMatches.map((p) => {
                              const csvCtx = previewAmbiguities.find(
                                (px) => px.key === r.key
                              );
                              const team = (p as any).teamAbbrev || csvCtx?.csvTeam || "??";
                              const pos = (p as any).position || csvCtx?.csvPos || "?";
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.fullName} ({team} {pos})
                                </option>
                              );
                            })}
                          </select>
                          <input
                            type="text"
                            placeholder="Search players…"
                            value={search}
                            onChange={(e) =>
                              setSearchInputs((prev) => ({
                                ...prev,
                                [r.key]: e.target.value
                              }))
                            }
                            style={{
                              flex: "1 1 160px",
                              minWidth: 160,
                              padding: 4
                            }}
                          />
                          <button
                            onClick={() =>
                              setRejectedSuggestions((s) => {
                                const n = new Set(s);
                                n.delete(r.key);
                                return n;
                              })
                            }
                            style={smallSecondaryBtn}
                          >
                            Back
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="sourceName"
            style={{ display: "block", marginBottom: 4 }}
          >
            Projection Source Name:
          </label>
          <input
            id="sourceName"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 4,
              border: "1px solid #ccc"
            }}
            placeholder="Enter a name for this source"
          />
        </div>

        {/* Unresolved / Unmapped summary banners */}
        <div style={{ marginTop: "12px" }}>
          {unresolvedCount > 0 && !forceImportDespiteUnresolved && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                color: "#856404",
                padding: "8px 12px",
                borderRadius: 4,
                marginBottom: 12
              }}
            >
              {unresolvedCount} unresolved ambiguous name
              {unresolvedCount !== 1 ? "s" : ""}. Resolve them or{" "}
              <button
                style={{ textDecoration: "underline" }}
                onClick={() => setForceImportDespiteUnresolved(true)}
              >
                force import anyway
              </button>
              .
            </div>
          )}
          {unresolvedCount === 0 &&
            liveUnmapped.length > 0 &&
            !forceImportDespiteUnresolved && (
              <div
                style={{
                  background: "#cce5ff",
                  border: "1px solid #b8daff",
                  color: "#004085",
                  padding: "8px 12px",
                  borderRadius: 4,
                  marginBottom: 12
                }}
              >
                {liveUnmapped.length} row{liveUnmapped.length !== 1 ? "s" : ""}{" "}
                lack a player_id. You can still{" "}
                <button
                  style={{ textDecoration: "underline" }}
                  onClick={() => setForceImportDespiteUnresolved(true)}
                >
                  force import
                </button>{" "}
                or adjust mappings.
              </div>
            )}
          {(unresolvedCount > 0 || liveUnmapped.length > 0) &&
            forceImportDespiteUnresolved && (
              <div
                style={{
                  background: "#f8d7da",
                  border: "1px solid #f5c6cb",
                  color: "#721c24",
                  padding: "8px 12px",
                  borderRadius: 4,
                  marginBottom: 12
                }}
              >
                Forcing import with {unresolvedCount} unresolved ambiguous name
                {unresolvedCount !== 1 ? "s" : ""} and {liveUnmapped.length}{" "}
                unmapped row{liveUnmapped.length !== 1 ? "s" : ""}.
              </div>
            )}
        </div>

        <div className="modalFooter" style={footerStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              !forceImportDespiteUnresolved &&
              (unresolvedCount > 0 ||
                (unresolvedCount === 0 && liveUnmapped.length > 0))
            }
            style={primaryButtonStyle}
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline styles to avoid external CSS dependencies here
const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
};
const modalStyle: React.CSSProperties = {
  background: "#121212",
  color: "#f5f5f5",
  width: "min(1000px, 96vw)",
  maxHeight: "90vh",
  borderRadius: 8,
  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  padding: 12,
  outline: "none"
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 8,
  borderBottom: "1px solid #333"
};
const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 12,
  borderTop: "1px solid #333",
  paddingTop: 8
};
const buttonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 20,
  cursor: "pointer"
};
const primaryButtonStyle: React.CSSProperties = {
  background: "#1976d2",
  color: "white",
  border: 0,
  padding: "8px 12px",
  borderRadius: 4,
  cursor: "pointer"
};
const secondaryButtonStyle: React.CSSProperties = {
  background: "#2e2e2e",
  color: "white",
  border: 0,
  padding: "8px 12px",
  borderRadius: 4,
  cursor: "pointer"
};
const dropzoneStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 120,
  border: "2px dashed #888",
  borderRadius: 8,
  marginTop: 8
};

const smallPrimaryBtn: React.CSSProperties = {
  background: "#1976d2",
  color: "#fff",
  border: 0,
  padding: "2px 10px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer"
};
const smallSecondaryBtn: React.CSSProperties = {
  background: "#2e2e2e",
  color: "#fff",
  border: 0,
  padding: "2px 10px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer"
};
