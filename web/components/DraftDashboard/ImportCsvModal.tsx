import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { standardizePlayerName } from "../../lib/standardization/nameStandardization";
import { teamsInfo } from "../../lib/teamsInfo";
import supabase from "lib/supabase";
import {
  defaultCanonicalColumnMap,
  standardizeColumnName
} from "../../lib/standardization/columnStandardization";

export type CsvPreviewRow = Record<string, string | number | null>;

type HeaderConfig = {
  original: string;
  standardized: string;
  selected: boolean;
  status?: "supported" | "unsupported" | "required";
  error?: string | null;
};

const REQUIRED_COLUMNS = [
  "Player_Name",
  "Team_Abbreviation",
  "Position",
  "Goals",
  "Assists"
];

const FIRST_NAME_ALIASES: Record<string, string[]> = {
  nicholas: ["nick", "nicky"],
  nick: ["nicholas"],
  michael: ["mike", "mikey"],
  mike: ["michael", "mikey"],
  matthew: ["matt", "matty"],
  matt: ["matthew", "matty"],
  zachary: ["zach", "zac", "zack"],
  zach: ["zachary", "zac", "zack"],
  zac: ["zachary", "zach", "zack"],
  zack: ["zachary", "zach", "zac"],
  jacob: ["jake"],
  jake: ["jacob"],
  alexander: ["alex", "sasha"],
  alex: ["alexander"],
  alexis: ["alex"],
  jonathan: ["john", "jon", "johnny"],
  john: ["jon", "jonathan"],
  jon: ["john", "jonathan"],
  william: ["will", "bill", "billy", "liam"],
  will: ["william"],
  liam: ["william"],
  stanislav: ["stan"],
  daniel: ["dan", "danny"],
  danila: ["danil", "dan"],
  maxim: ["max"],
  max: ["maxim", "maxwell"],
  alexei: ["alexey", "alex"],
  alexey: ["alexei", "alex"],
  andrei: ["andrew", "andy"],
  andrew: ["andrei", "andy", "drew"],
  joseph: ["joe", "joey"],
  jose: ["joe", "joey"],
  josef: ["joe", "joey"],
  isaac: ["ike"],
  michaelson: ["mike"],
  artemiy: ["artem"],
  artemi: ["artem"],
  alexanderh: ["sasha"],
  brandon: ["brad"],
  drew: ["andrew"],
  nathan: ["nate"],
  nate: ["nathan"],
  gabriel: ["gaby", "gabe"],
  gabe: ["gabriel", "gaby"],
  patrick: ["pat"],
  pat: ["patrick"],
  caleb: ["cale"],
  cale: ["caleb"],
  luke: ["luc"],
  luc: ["luke"],
  alexandre: ["alex", "sasha"],
  mattias: ["matty", "matt"],
  mattes: ["matt"],
  thomas: ["tom", "tommy", "tomas"],
  tomas: ["thomas", "tom"],
  alexandar: ["alex", "sasha"],
  darcy: ["darce"],
  sergei: ["sergey"],
  sergey: ["sergei"],
  ilya: ["ilya"],
  illya: ["ilya"],
  mikhail: ["mike"],
  matias: ["matt"],
  mathew: ["matt"],
  nicolas: ["nick"],
  niklas: ["nick"],
  steven: ["steve"],
  stephen: ["steve"],
  vladimir: ["vlad"],
  vladislav: ["vlad"],
  alexi: ["alex", "alexei"]
};

const CANONICAL_COLUMN_OPTIONS = Array.from(
  new Set([...Object.values(defaultCanonicalColumnMap), "player_id"])
).sort();

const ALLOWED_COLUMNS = new Set<string>(CANONICAL_COLUMN_OPTIONS);
const REQUIRED_COLUMN_SET = new Set(REQUIRED_COLUMNS);

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

function stdName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));
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
  return dp[m][n];
}

type PlayerIndexRecord = {
  id: number;
  fullName: string;
  position: string | null;
  lastName?: string | null;
  teamId?: number | null;
  teamAbbrev?: string | null;
  std: string;
};

type ResolutionStats = {
  totalRows: number;
  idMatched: number;
  nameMatched: number;
  fuzzyMatched: number;
  manualOverrides: number;
  unresolved: number;
  invalidIds: number;
  coverage: number;
  lastUpdated: number;
  unresolvedNames: string[];
};

type RowResolutionDetail = {
  name: string;
  method: string;
  playerId: number | null;
  invalidOriginalId: boolean;
};

const TEAM_ID_BY_ABBREV = new Map<string, number>();
const TEAM_ABBREV_BY_ID = new Map<number, string>();
for (const [abbr, info] of Object.entries(teamsInfo)) {
  const upper = abbr.toUpperCase();
  TEAM_ID_BY_ABBREV.set(upper, info.id);
  TEAM_ABBREV_BY_ID.set(info.id, upper);
}

type ImportCsvModalProps = {
  open: boolean;
  onClose: () => void;
  minimumCoveragePercent?: number;
  allowNameFallback?: boolean;
  onFallbackSettingsChange?: (settings: {
    allowCustomNameFallback: boolean;
    minimumCoveragePercent: number;
  }) => void;
  onImported: (args: {
    headers: HeaderConfig[];
    rows: CsvPreviewRow[];
    sourceId: string;
    label: string;
    resolution: {
      totalRows: number;
      idMatched: number;
      nameMatched: number;
      fuzzyMatched: number;
      manualOverrides: number;
      unresolved: number;
      invalidIds: number;
      coverage: number;
      lastUpdated: number;
      unresolvedNames: string[];
    };
  }) => void;
};

export default function ImportCsvModal({
  open,
  onClose,
  onImported,
  minimumCoveragePercent = 25,
  allowNameFallback = true,
  onFallbackSettingsChange
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
      teamId?: number | null;
      teamAbbrev?: string | null;
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
  const [requireFullMapping, setRequireFullMapping] = useState(false);
  const [collapseHeaderMapping, setCollapseHeaderMapping] = useState(false);
  const [collapseUnresolved, setCollapseUnresolved] = useState(false);
  const [collapseAmbiguities, setCollapseAmbiguities] = useState(false);
  const [manualSearchInputs, setManualSearchInputs] = useState<
    Record<string, string>
  >({});
  const loggedTargetsRef = useRef(false);
  const rosterIndex = useMemo(() => {
    const ids = new Set<number>();
    const byStdName = new Map<string, PlayerIndexRecord[]>();
    const byTeamAbbrev = new Map<string, PlayerIndexRecord[]>();
    const byId = new Map<number, PlayerIndexRecord>();
    dbPlayers.forEach((p) => {
      const std = stdName(p.fullName);
      const record: PlayerIndexRecord = {
        id: p.id,
        fullName: p.fullName,
        position: p.position ?? null,
        lastName: p.lastName,
        teamId: p.teamId ?? null,
        teamAbbrev: p.teamAbbrev ?? null,
        std
      };
      ids.add(record.id);
      if (!byStdName.has(std)) byStdName.set(std, []);
      byStdName.get(std)!.push(record);
      if (record.teamAbbrev) {
        const key = record.teamAbbrev.toUpperCase();
        if (!byTeamAbbrev.has(key)) byTeamAbbrev.set(key, []);
        byTeamAbbrev.get(key)!.push(record);
      }
      byId.set(record.id, record);

      // Inject common first-name aliases (Nick <-> Nicholas, etc.)
      const tokens = p.fullName.split(/\s+/);
      if (tokens.length > 0) {
        const first = tokens[0];
        const rest = tokens.slice(1).join(" ");
        const firstNorm = stdName(first);
        const aliases = FIRST_NAME_ALIASES[firstNorm];
        if (aliases && aliases.length) {
          aliases.forEach((alias) => {
            const aliasFirst = alias.slice(0, 1).toUpperCase() + alias.slice(1);
            const aliasFullName = rest ? `${aliasFirst} ${rest}` : aliasFirst;
            const aliasStd = stdName(aliasFullName);
            if (!aliasStd || aliasStd === std) return;
            if (!byStdName.has(aliasStd)) byStdName.set(aliasStd, []);
            const list = byStdName.get(aliasStd)!;
            if (!list.some((rec) => rec.id === record.id)) {
              list.push(record);
            }
          });
        }
      }
    });
    return {
      ids,
      byStdName,
      byTeamAbbrev,
      byId
    };
  }, [dbPlayers]);

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
              .select("id, fullName, position, lastName, team_id")
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
                lastName: (r as any).lastName ?? null,
                teamId: (r as any).team_id ?? null,
                teamAbbrev:
                  typeof (r as any).team_id === "number"
                    ? TEAM_ABBREV_BY_ID.get((r as any).team_id) || null
                    : null
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
          .select("id, fullName, position, lastName, team_id")
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
                lastName: (r as any).lastName ?? null,
                teamId: (r as any).team_id ?? null,
                teamAbbrev:
                  typeof (r as any).team_id === "number"
                    ? TEAM_ABBREV_BY_ID.get((r as any).team_id) || null
                    : null
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

  const classifyColumn = useCallback((standardized: string) => {
    if (REQUIRED_COLUMN_SET.has(standardized)) {
      return {
        status: "required" as HeaderConfig["status"],
        selected: true,
        error: null
      };
    }
    if (ALLOWED_COLUMNS.has(standardized)) {
      return {
        status: "supported" as HeaderConfig["status"],
        selected: true,
        error: null
      };
    }
    return {
      status: "unsupported" as HeaderConfig["status"],
      selected: false,
      error: "Unrecognized column. Choose a supported option or uncheck."
    };
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
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
          const processed = incomingHeaders.map((h) => {
            const standardized = standardizeColumnName(h);
            const classification = classifyColumn(standardized);
            return {
              original: h,
              standardized,
              selected: classification.selected,
              status: classification.status,
              error: classification.error
            } as HeaderConfig;
          });
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
    },
    [classifyColumn]
  );

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

  const resolutionResult = useMemo(() => {
    const baseRows = allRows.length ? allRows : rawRows;
    const selectedHeaders = headers.filter((h) => h.selected);
    if (!baseRows.length || !selectedHeaders.length) {
      const emptyStats: ResolutionStats = {
        totalRows: 0,
        idMatched: 0,
        nameMatched: 0,
        fuzzyMatched: 0,
        manualOverrides: 0,
        unresolved: 0,
        invalidIds: 0,
        coverage: 0,
        lastUpdated: Date.now(),
        unresolvedNames: []
      };
      return {
        rows: [] as CsvPreviewRow[],
        stats: emptyStats,
        detail: [] as RowResolutionDetail[]
      };
    }

    const playerIdKeys = selectedHeaders
      .map((h) => h.standardized)
      .filter((key) => key.replace(/_/g, "").toLowerCase() === "playerid");

    const rows: CsvPreviewRow[] = [];
    const unresolvedNames = new Set<string>();
    const detail: RowResolutionDetail[] = [];
    let idMatched = 0;
    let nameMatched = 0;
    let fuzzyMatched = 0;
    let manualOverrides = 0;
    let resolvedCount = 0;
    let invalidIds = 0;
    const now = Date.now();

    baseRows.forEach((row) => {
      const out: CsvPreviewRow = {};
      let canonicalName = "";
      selectedHeaders.forEach((h) => {
        const v = (row as any)[h.original];
        if (
          (playerHeader && h.original === playerHeader) ||
          (!playerHeader && h.standardized === "Player_Name")
        ) {
          canonicalName = standardizePlayerName(String(v ?? ""));
          out[h.standardized] = canonicalName;
        } else {
          out[h.standardized] = v as any;
        }
      });

      if (!canonicalName) {
        const fallback = standardizePlayerName(
          String(
            (row as any).Player_Name ||
              (row as any).player_name ||
              (row as any).Name ||
              ""
          )
        );
        if (fallback) {
          canonicalName = fallback;
          (out as any).Player_Name = fallback;
        }
      }

      const trimmedName = canonicalName.trim();
      const stdKey = trimmedName ? stdName(trimmedName) : "";
      const manualChoice = trimmedName
        ? ambiguousChoices[trimmedName]
        : undefined;
      const csvTeamRaw =
        (out as any).Team_Abbreviation ??
        (out as any).Team ??
        (out as any).team_abbreviation ??
        (out as any).team;
      const csvTeamAbbrev =
        typeof csvTeamRaw === "string" && csvTeamRaw.trim() !== ""
          ? csvTeamRaw.trim().toUpperCase()
          : null;
      const csvTeamId = csvTeamAbbrev
        ? (TEAM_ID_BY_ABBREV.get(csvTeamAbbrev) ?? null)
        : null;

      let finalId: number | null = null;
      let method = "unresolved";
      let invalidOriginalId = false;

      if (typeof manualChoice === "number" && Number.isFinite(manualChoice)) {
        finalId = manualChoice;
        method = "manual";
        manualOverrides++;
        resolvedCount++;
      } else {
        let originalId: number | null = null;
        for (const key of playerIdKeys) {
          const rawVal = (out as any)[key];
          if (rawVal == null || rawVal === "") continue;
          const numeric = Number(rawVal);
          if (Number.isFinite(numeric)) {
            originalId = numeric;
            break;
          }
        }

        if (originalId != null) {
          if (rosterIndex.ids.has(originalId)) {
            finalId = originalId;
            method = "id";
            idMatched++;
            resolvedCount++;
          } else {
            invalidOriginalId = true;
          }
        }

        if (finalId == null && stdKey) {
          const candidates = rosterIndex.byStdName.get(stdKey) || [];
          if (candidates.length === 1) {
            finalId = candidates[0].id;
            method = "name";
            nameMatched++;
            resolvedCount++;
          } else if (candidates.length > 1 && csvTeamAbbrev) {
            const filtered = candidates.filter((cand) => {
              const candTeam = cand.teamAbbrev?.toUpperCase();
              if (candTeam) return candTeam === csvTeamAbbrev;
              if (csvTeamId != null && typeof cand.teamId === "number") {
                return cand.teamId === csvTeamId;
              }
              return false;
            });
            if (filtered.length === 1) {
              finalId = filtered[0].id;
              method = "name";
              nameMatched++;
              resolvedCount++;
            }
          }

          if (finalId == null && csvTeamAbbrev) {
            const teamCandidates =
              rosterIndex.byTeamAbbrev.get(csvTeamAbbrev) || [];
            let bestCandidate: PlayerIndexRecord | undefined;
            let bestDist = Number.POSITIVE_INFINITY;
            teamCandidates.forEach((candidate) => {
              const dist = levenshteinDistance(stdKey, candidate.std);
              if (dist <= 2 && dist < bestDist) {
                bestDist = dist;
                bestCandidate = candidate;
              }
            });
            if (bestCandidate) {
              finalId = bestCandidate.id;
              method = "fuzzy";
              fuzzyMatched++;
              resolvedCount++;
            }
          }
        }
      }

      if (invalidOriginalId) invalidIds++;

      const playerIdTargets = Array.from(
        new Set(
          playerIdKeys.length ? [...playerIdKeys, "player_id"] : ["player_id"]
        )
      );

      if (finalId != null) {
        playerIdTargets.forEach((key) => {
          (out as any)[key] = finalId;
        });
      } else {
        playerIdTargets.forEach((key) => {
          delete (out as any)[key];
        });
        if (trimmedName) unresolvedNames.add(trimmedName);
      }

      (out as any).__resolution = {
        method,
        stdKey,
        team: csvTeamAbbrev,
        manualOverride: method === "manual",
        invalidOriginalId
      };

      detail.push({
        name: trimmedName,
        method,
        playerId: finalId,
        invalidOriginalId
      });
      rows.push(out);
    });

    const totalRows = rows.length;
    const resolved = resolvedCount;
    const unresolved = totalRows - resolved;
    const coverage = totalRows ? resolved / totalRows : 0;

    const stats: ResolutionStats = {
      totalRows,
      idMatched,
      nameMatched,
      fuzzyMatched,
      manualOverrides,
      unresolved,
      invalidIds,
      coverage,
      lastUpdated: now,
      unresolvedNames: Array.from(unresolvedNames).sort()
    };

    return { rows, stats, detail };
  }, [allRows, rawRows, headers, playerHeader, ambiguousChoices, rosterIndex]);

  const resolvedRows = resolutionResult.rows;
  const resolutionStats = resolutionResult.stats;
  const [localAllowFallback, setLocalAllowFallback] =
    useState(allowNameFallback);
  const [localMinCoverage, setLocalMinCoverage] = useState(
    minimumCoveragePercent
  );
  useEffect(() => {
    setLocalAllowFallback(allowNameFallback);
  }, [allowNameFallback]);
  useEffect(() => {
    setLocalMinCoverage(minimumCoveragePercent);
  }, [minimumCoveragePercent]);
  const coverageThreshold = Math.max(0, localMinCoverage) / 100;
  const coverageBelowThreshold =
    resolutionStats.totalRows > 0 &&
    resolutionStats.coverage < coverageThreshold;
  const hasUnresolvedRows = resolutionStats.unresolved > 0;
  const coveragePercentDisplay = (resolutionStats.coverage * 100).toFixed(1);
  const mappedCount = resolutionStats.totalRows - resolutionStats.unresolved;
  const unresolvedNames = resolutionStats.unresolvedNames;
  const confirmDisabled =
    (requireFullMapping && resolutionStats.coverage < 1) ||
    (!forceImportDespiteUnresolved &&
      (hasUnresolvedRows || coverageBelowThreshold));

  useEffect(() => {
    if (requireFullMapping) {
      setForceImportDespiteUnresolved(false);
    }
  }, [requireFullMapping]);

  useEffect(() => {
    if (!open) return;
    setForceImportDespiteUnresolved(false);
  }, [open, resolutionStats.totalRows]);

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
  const levenshtein = useCallback(
    (a: string, b: string) => levenshteinDistance(a, b),
    []
  );

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
        (acc, r) => acc + r.candidates.filter((c) => !c.teamAbbrev).length,
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

  const handleConfirm = () => {
    if (missingRequired.length) {
      setError(`Missing required columns: ${missingRequired.join(", ")}`);
      return;
    }
    const coverageThreshold = Math.max(0, localMinCoverage) / 100;
    const coverageBelowThreshold =
      resolutionStats.totalRows > 0 &&
      resolutionStats.coverage < coverageThreshold;
    const hasUnresolvedRows = resolutionStats.unresolved > 0;
    if (requireFullMapping && resolutionStats.coverage < 1) {
      setError(
        "Require full mapping is enabled. Resolve all players before importing."
      );
      return;
    }
    if (
      (hasUnresolvedRows || coverageBelowThreshold) &&
      !forceImportDespiteUnresolved
    ) {
      setError(
        coverageBelowThreshold
          ? `Coverage ${(resolutionStats.coverage * 100).toFixed(1)}% is below the minimum ${localMinCoverage}%. Review or force import.`
          : `There are still ${resolutionStats.unresolved} unresolved players. Review or force import.`
      );
      return;
    }
    const mapped = resolvedRows;
    if (!mapped.length) {
      setError("No rows available to import.");
      return;
    }
    const resolutionPayload: ResolutionStats = {
      ...resolutionStats,
      lastUpdated: Date.now(),
      unresolvedNames: [...resolutionStats.unresolvedNames]
    };
    onFallbackSettingsChange?.({
      allowCustomNameFallback: localAllowFallback,
      minimumCoveragePercent: localMinCoverage
    });
    try {
      console.log(
        `[ImportCsvModal] Resolution summary: total=${resolutionPayload.totalRows}, id=${resolutionPayload.idMatched}, name=${resolutionPayload.nameMatched}, fuzzy=${resolutionPayload.fuzzyMatched}, manual=${resolutionPayload.manualOverrides}, unresolved=${resolutionPayload.unresolved}, invalidIds=${resolutionPayload.invalidIds}, coverage=${(resolutionPayload.coverage * 100).toFixed(1)}%`
      );
    } catch {}
    const payload = {
      headers,
      rows: mapped,
      sourceId: "custom_csv",
      label: sourceName,
      resolution: resolutionPayload
    } as const;
    onImported(payload);
    onClose();
  };

  const handleHeaderToggle = (idx: number) => {
    setHeaders((prev) =>
      prev.map((h, i) => {
        if (i !== idx) return h;
        if (h.status === "required") return h;
        return { ...h, selected: !h.selected };
      })
    );
  };

  const handleHeaderNameChange = (idx: number, value: string) => {
    setHeaders((prev) =>
      prev.map((h, i) => {
        if (i !== idx) return h;
        let nextStandardized = value.trim();
        if (
          !ALLOWED_COLUMNS.has(nextStandardized) &&
          !REQUIRED_COLUMN_SET.has(nextStandardized)
        ) {
          nextStandardized = standardizeColumnName(value);
        }
        const classification = classifyColumn(nextStandardized);
        const wasUnsupported = h.status === "unsupported";
        const nextSelected =
          classification.status === "required"
            ? true
            : classification.status === "supported"
              ? true
              : classification.status === "unsupported"
                ? wasUnsupported
                  ? h.selected
                  : false
                : h.selected;
        return {
          ...h,
          standardized: nextStandardized,
          status: classification.status,
          selected: nextSelected,
          error: classification.error
        };
      })
    );
  };

  const handleManualResolve = (name: string, playerId: number) => {
    setAmbiguousChoices((prev) => ({ ...prev, [name]: playerId }));
    const rec = rosterIndex.byId.get(playerId);
    setManualSearchInputs((prev) => ({
      ...prev,
      [name]: rec?.fullName || prev[name] || ""
    }));
  };

  const handleManualClear = (name: string) => {
    setAmbiguousChoices((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, name)) delete next[name];
      return next;
    });
    setManualSearchInputs((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, name)) delete next[name];
      return next;
    });
  };

  // ---- Derived hook values (must be before any early returns to preserve hook order) ----
  // Count unresolved ambiguous names
  const unresolvedCount = useMemo(
    () =>
      ambiguousWithSuggestions.filter((r) => !ambiguousChoices[r.key]).length,
    [ambiguousWithSuggestions, ambiguousChoices]
  );

  // Live mapped rows & unmapped count (for banner guard) – lightweight derivation
  const liveMappedRows = resolvedRows;
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
        <div style={contentStyle}>
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

          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center"
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={localAllowFallback}
                onChange={(e) => setLocalAllowFallback(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>
                Allow name fallback when player IDs are missing
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13 }}>Minimum coverage (%):</span>
              <input
                type="number"
                min={0}
                max={100}
                value={localMinCoverage}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  if (Number.isNaN(raw)) return;
                  setLocalMinCoverage(Math.max(0, Math.min(100, raw)));
                }}
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                style={{
                  width: 70,
                  padding: "4px 6px",
                  borderRadius: 4,
                  border: "1px solid #555",
                  background: "#181818",
                  color: "#f5f5f5"
                }}
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
              Use standardized names to fill missing IDs automatically and gate
              import when matches fall below your coverage threshold.
            </p>
          </div>

          {headers.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6
                }}
              >
                <h3 style={{ margin: 0 }}>Header mapping</h3>
                <button
                  type="button"
                  onClick={() => setCollapseHeaderMapping((v) => !v)}
                  style={smallSecondaryBtn}
                >
                  {collapseHeaderMapping ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapseHeaderMapping && (
                <>
                  <div
                    style={{
                      maxHeight: 240,
                      overflow: "auto",
                      border: "1px solid #2f2f2f",
                      borderRadius: 6
                    }}
                  >
                    <datalist id="import-csv-header-options">
                      {CANONICAL_COLUMN_OPTIONS.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th align="left">Include</th>
                          <th align="left">Original</th>
                          <th align="left">Standardized</th>
                          <th align="left">Player Column</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headers.map((h, idx) => {
                          const isRequired = h.status === "required";
                          const isUnsupported = h.status === "unsupported";
                          const rowStyle: React.CSSProperties | undefined =
                            isUnsupported
                              ? {
                                  background: "rgba(211, 50, 47, 0.12)",
                                  borderLeft: "3px solid #d32f2f"
                                }
                              : undefined;
                          const inputStyle: React.CSSProperties = {
                            width: "100%",
                            border: `1px solid ${isUnsupported ? "#d32f2f" : "#444"}`,
                            background: "#181818",
                            color: "#f5f5f5",
                            borderRadius: 4,
                            padding: "4px 6px"
                          };
                          return (
                            <tr key={h.original} style={rowStyle}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={h.selected}
                                  onChange={() => handleHeaderToggle(idx)}
                                  aria-label={`Toggle include ${h.original}`}
                                  disabled={isRequired}
                                />
                              </td>
                              <td>{h.original}</td>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4
                                  }}
                                >
                                  <input
                                    type="text"
                                    list="import-csv-header-options"
                                    value={h.standardized}
                                    onChange={(e) =>
                                      handleHeaderNameChange(
                                        idx,
                                        e.target.value
                                      )
                                    }
                                    aria-label={`Standardized name for ${h.original}`}
                                    style={inputStyle}
                                  />
                                  {h.error && (
                                    <span
                                      style={{
                                        color: "#ff8a80",
                                        fontSize: 11
                                      }}
                                    >
                                      {h.error}
                                    </span>
                                  )}
                                </div>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {missingRequired.length > 0 && (
                    <p style={{ color: "#d32f2f", marginTop: 6 }}>
                      Missing required: {missingRequired.join(", ")}
                    </p>
                  )}

                  <h3 style={{ margin: "12px 0 4px" }}>
                    Preview (first 50 rows)
                  </h3>
                  <div
                    style={{
                      maxHeight: 180,
                      overflow: "auto",
                      border: "1px solid #2f2f2f",
                      borderRadius: 6
                    }}
                  >
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          {headers
                            .filter((h) => h.selected)
                            .map((h) => (
                              <th
                                key={h.original}
                                style={{ borderBottom: "1px solid #333" }}
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
                                  style={{ borderBottom: "1px solid #2a2a2a" }}
                                >
                                  {String(row[h.standardized] ?? "")}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {(resolutionStats.totalRows > 0 || unresolvedNames.length > 0) && (
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
              }}
            >
              {resolutionStats.totalRows > 0 && (
                <div
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #295644",
                    borderRadius: 8,
                    background: "rgba(41, 86, 68, 0.2)"
                  }}
                >
                  <h3 style={{ margin: "0 0 6px" }}>
                    Name → ID Mapping Summary
                  </h3>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Coverage: <strong>{coveragePercentDisplay}%</strong> (
                    {mappedCount}/{resolutionStats.totalRows} rows mapped). ID
                    matches: {resolutionStats.idMatched}, Name matches:{" "}
                    {resolutionStats.nameMatched}
                    {resolutionStats.fuzzyMatched > 0
                      ? ` (fuzzy: ${resolutionStats.fuzzyMatched})`
                      : ""}
                    , Manual: {resolutionStats.manualOverrides}, Unresolved:{" "}
                    {resolutionStats.unresolved}.
                  </p>
                  {resolutionStats.invalidIds > 0 && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#ffb74d"
                      }}
                    >
                      {resolutionStats.invalidIds} player_id value(s) not
                      present in the roster were repaired via name matching.
                    </p>
                  )}
                  {!localAllowFallback && hasUnresolvedRows && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#ff8a80"
                      }}
                    >
                      Name fallback is disabled. Unresolved rows will be ignored
                      until mapped.
                    </p>
                  )}
                </div>
              )}
              {unresolvedNames.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6
                    }}
                  >
                    <h4 style={{ margin: 0 }}>
                      Unresolved Players ({unresolvedNames.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCollapseUnresolved((v) => !v)}
                      style={smallSecondaryBtn}
                    >
                      {collapseUnresolved ? "Expand" : "Collapse"}
                    </button>
                  </div>
                  {!collapseUnresolved && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        maxHeight: 260,
                        overflowY: "auto",
                        paddingRight: 4
                      }}
                    >
                      {unresolvedNames.map((name) => {
                        const searchValue = manualSearchInputs[name] ?? "";
                        const normalized = searchValue.trim().toLowerCase();
                        const baseSuggestions =
                          rosterIndex.byStdName.get(stdName(name)) || [];
                        const suggestionsMap = new Map<
                          number,
                          PlayerIndexRecord
                        >();
                        baseSuggestions.forEach((rec) =>
                          suggestionsMap.set(rec.id, rec)
                        );
                        if (normalized.length >= 2) {
                          dbPlayers
                            .filter((p) =>
                              p.fullName.toLowerCase().includes(normalized)
                            )
                            .slice(0, 12)
                            .forEach((p) => {
                              const rec =
                                rosterIndex.byId.get(p.id) ||
                                ({
                                  id: p.id,
                                  fullName: p.fullName,
                                  position: p.position ?? null,
                                  lastName: p.lastName ?? null,
                                  teamId: p.teamId ?? null,
                                  teamAbbrev: p.teamAbbrev ?? null,
                                  std: stdName(p.fullName)
                                } as PlayerIndexRecord);
                              suggestionsMap.set(rec.id, rec);
                            });
                        }
                        const suggestionList = Array.from(
                          suggestionsMap.values()
                        ).slice(0, 12);
                        const selectedId = ambiguousChoices[name];
                        const selectedPlayer =
                          typeof selectedId === "number"
                            ? rosterIndex.byId.get(selectedId)
                            : undefined;
                        return (
                          <div
                            key={name}
                            style={{
                              border: "1px solid #2f2f2f",
                              borderRadius: 8,
                              padding: "10px 12px",
                              background: "rgba(255,255,255,0.03)"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap"
                              }}
                            >
                              <strong>{name}</strong>
                              {selectedPlayer && (
                                <span style={{ fontSize: 12, opacity: 0.8 }}>
                                  Matched: {selectedPlayer.fullName}
                                  {selectedPlayer.teamAbbrev
                                    ? ` (${selectedPlayer.teamAbbrev}`
                                    : ""}
                                  {selectedPlayer.position
                                    ? ` ${selectedPlayer.position})`
                                    : selectedPlayer.teamAbbrev
                                      ? ")"
                                      : ""}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6
                              }}
                            >
                              <input
                                type="text"
                                value={searchValue}
                                placeholder="Search players…"
                                onChange={(e) =>
                                  setManualSearchInputs((prev) => ({
                                    ...prev,
                                    [name]: e.target.value
                                  }))
                                }
                                style={{
                                  border: "1px solid #444",
                                  background: "#111",
                                  color: "#f5f5f5",
                                  borderRadius: 4,
                                  padding: "4px 6px"
                                }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6
                                }}
                              >
                                {suggestionList.length === 0 && (
                                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                                    {normalized.length < 2
                                      ? "Type at least two letters to search our roster."
                                      : "No matches found."}
                                  </span>
                                )}
                                {suggestionList.map((rec) => {
                                  const labelTeam = rec.teamAbbrev || "FA";
                                  const labelPos = rec.position || "";
                                  const isActive =
                                    typeof selectedId === "number" &&
                                    selectedId === rec.id;
                                  return (
                                    <button
                                      key={rec.id}
                                      type="button"
                                      onClick={() =>
                                        handleManualResolve(name, rec.id)
                                      }
                                      style={{
                                        ...smallPrimaryBtn,
                                        background: isActive
                                          ? "#2e7d32"
                                          : "#1976d2"
                                      }}
                                    >
                                      {rec.fullName} ({labelTeam}
                                      {labelPos ? ` ${labelPos}` : ""})
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedPlayer && (
                                <button
                                  type="button"
                                  onClick={() => handleManualClear(name)}
                                  style={smallSecondaryBtn}
                                >
                                  Clear match
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {ambiguousWithSuggestions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6
                }}
              >
                <h3 style={{ margin: 0 }}>Resolve Ambiguous Names</h3>
                <button
                  type="button"
                  onClick={() => setCollapseAmbiguities((v) => !v)}
                  style={smallSecondaryBtn}
                >
                  {collapseAmbiguities ? "Expand" : "Collapse"}
                </button>
              </div>
              {!collapseAmbiguities && (
                <>
                  <p style={{ opacity: 0.8, marginTop: 0 }}>
                    We auto-resolve perfect unique matches. Accept or override
                    others below. Use search if needed.
                  </p>
                  {ambiguousWithSuggestions.some(
                    (r) => ambiguousChoices[r.key]
                  ) && (
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
                          const raw = previewAmbiguities.find(
                            (p) => p.key === r.key
                          );
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
                                      const team =
                                        suggestion.teamAbbrev || "??";
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
                                        (s) =>
                                          new Set([...Array.from(s), r.key])
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
                                    const team =
                                      c.teamAbbrev || csvCtx?.csvTeam || "??";
                                    const pos =
                                      c.position || csvCtx?.csvPos || "?";
                                    return (
                                      <option key={c.id} value={c.id}>
                                        {c.fullName} ({team} {pos}){" "}
                                        {(c.score * 100).toFixed(0)}%
                                      </option>
                                    );
                                  })}
                                  {dynamicMatches.length > 0 && (
                                    <option disabled>
                                      -- Search Results --
                                    </option>
                                  )}
                                  {dynamicMatches.map((p) => {
                                    const csvCtx = previewAmbiguities.find(
                                      (px) => px.key === r.key
                                    );
                                    const team =
                                      (p as any).teamAbbrev ||
                                      csvCtx?.csvTeam ||
                                      "??";
                                    const pos =
                                      (p as any).position ||
                                      csvCtx?.csvPos ||
                                      "?";
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
                </>
              )}
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

          {/* Unresolved / coverage warnings */}
          <div style={{ marginTop: "12px" }}>
            {(hasUnresolvedRows || coverageBelowThreshold) &&
              !forceImportDespiteUnresolved && (
                <div
                  style={{
                    background: "#fff3cd",
                    border: "1px solid #ffeeba",
                    color: "#856404",
                    padding: "10px 12px",
                    borderRadius: 4,
                    marginBottom: 12
                  }}
                >
                  <strong>Low ID match rate.</strong>{" "}
                  {resolutionStats.unresolved} unresolved row
                  {resolutionStats.unresolved === 1 ? "" : "s"}; coverage{" "}
                  {coveragePercentDisplay}% (minimum {localMinCoverage}%).
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center"
                    }}
                  >
                    <button
                      style={{
                        background: "#1976d2",
                        color: "white",
                        border: 0,
                        padding: "6px 10px",
                        borderRadius: 4,
                        cursor: "pointer"
                      }}
                      onClick={() => setForceImportDespiteUnresolved(true)}
                    >
                      Enable anyway
                    </button>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>
                      {localAllowFallback
                        ? "We'll use name fallback during aggregation, but accuracy may drop."
                        : "Name fallback is disabled; unresolved rows won't project."}
                    </span>
                  </div>
                </div>
              )}

            {(hasUnresolvedRows || coverageBelowThreshold) &&
              forceImportDespiteUnresolved && (
                <div
                  style={{
                    background: "#f8d7da",
                    border: "1px solid #f5c6cb",
                    color: "#721c24",
                    padding: "10px 12px",
                    borderRadius: 4,
                    marginBottom: 12
                  }}
                >
                  Import will proceed with {resolutionStats.unresolved}{" "}
                  unresolved row{resolutionStats.unresolved === 1 ? "" : "s"} (
                  {coveragePercentDisplay}% coverage).
                </div>
              )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13
              }}
            >
              <input
                type="checkbox"
                checked={requireFullMapping}
                onChange={(e) => setRequireFullMapping(e.target.checked)}
              />
              Require full mapping (100% coverage)
            </label>
          </div>
        </div>

        <div className="modalFooter" style={footerStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
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
  width: "min(1150px, 96vw)",
  maxHeight: "92vh",
  borderRadius: 10,
  boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
  padding: 0,
  outline: "none",
  display: "flex",
  flexDirection: "column"
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 8,
  borderBottom: "1px solid #333",
  padding: "12px 16px"
};
const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  borderTop: "1px solid #333",
  padding: "12px 16px"
};
const buttonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 20,
  cursor: "pointer"
};
const contentStyle: React.CSSProperties = {
  padding: "0 16px 16px",
  overflowY: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 12
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
