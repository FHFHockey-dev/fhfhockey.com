import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import {
  standardizePlayerName,
  titleCase
} from "../../lib/standardization/nameStandardization";
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
  const [rawRows, setRawRows] = useState<CsvPreviewRow[]>([]);
  const [headers, setHeaders] = useState<HeaderConfig[]>([]);
  const [playerHeader, setPlayerHeader] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [sourceName, setSourceName] = useState("Custom CSV"); // Default name

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
    }
  }, [open, focusFirst]);

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
    const payload = {
      headers,
      rows: mappedPreview,
      sourceId: "custom_csv",
      label: sourceName // Use the custom name
    } as const;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ headers, rows: mappedPreview, label: sourceName })
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

        <div className="modalFooter" style={footerStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!headers.length || !!missingRequired.length}
            style={primaryButtonStyle}
          >
            Add as source
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
