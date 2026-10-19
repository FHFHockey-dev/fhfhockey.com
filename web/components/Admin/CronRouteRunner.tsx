import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  MenuItem,
  TextField,
  Typography
} from "@mui/material";

import supabase from "lib/supabase";

const CLIENT_TIMEOUT_MS = 300_000;
// Fixed base used only to resolve and check a relative path; never requested.
const VALIDATION_BASE = "https://same-origin.invalid";

type HttpMethod = "GET" | "POST";

export type AdminRoutePathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Accept only a same-origin relative path under /api/, so the admin bearer
 * token can never be sent to another host. Leading/trailing whitespace from a
 * paste is trimmed; any other whitespace or control character is rejected.
 */
export function validateAdminRoutePath(input: string): AdminRoutePathResult {
  const value = input.trim();
  if (!value) return { ok: false, error: "Enter a route path." };
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) {
    return {
      ok: false,
      error: "Whitespace and control characters are not allowed."
    };
  }
  if (value.includes("\\")) {
    return { ok: false, error: "Backslashes are not allowed." };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return { ok: false, error: "Absolute URLs are not allowed." };
  }
  if (value.startsWith("//")) {
    return { ok: false, error: "Protocol-relative URLs are not allowed." };
  }
  if (!value.startsWith("/api/")) {
    return { ok: false, error: "The path must start with /api/." };
  }

  let resolved: URL;
  try {
    resolved = new URL(value, VALIDATION_BASE);
  } catch {
    return { ok: false, error: "The path is not a valid URL path." };
  }
  if (
    resolved.origin !== VALIDATION_BASE ||
    !resolved.pathname.startsWith("/api/")
  ) {
    return { ok: false, error: "The path must stay under /api/." };
  }

  return { ok: true, path: `${resolved.pathname}${resolved.search}` };
}

type RunResult = {
  status: number | null;
  statusText: string;
  durationMs: number;
  body: string;
};

function formatBody(text: string) {
  if (!text) return "(empty response)";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

const inputSx = {
  backgroundColor: "#202020",
  borderRadius: "4px",
  "& .MuiInputBase-input, & .MuiInputLabel-root, & .MuiSelect-icon": {
    color: "#fff"
  }
};

export default function CronRouteRunner() {
  const [route, setRoute] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [body, setBody] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"cancel" | "timeout" | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    setError(null);
    setResult(null);

    // A full URL pasted from this same site is accepted as its path.
    const trimmedRoute = route.trim();
    const ownOrigin = typeof window === "undefined" ? null : window.location.origin;
    const validated = validateAdminRoutePath(
      ownOrigin && trimmedRoute.startsWith(`${ownOrigin}/`)
        ? trimmedRoute.slice(ownOrigin.length)
        : route,
    );
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    let requestBody: string | undefined;
    if (method === "POST" && body.trim()) {
      try {
        requestBody = JSON.stringify(JSON.parse(body));
      } catch {
        setError("The POST body is not valid JSON.");
        return;
      }
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setError("No signed-in session. Sign in again and retry.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    abortReasonRef.current = null;
    const timeoutId = setTimeout(() => {
      abortReasonRef.current = "timeout";
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    setRunning(true);
    const startedAt = performance.now();
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`
      };
      if (requestBody !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(validated.path, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
        credentials: "same-origin",
        // Do not follow redirects with the bearer token attached.
        redirect: "manual"
      });
      const text =
        response.type === "opaqueredirect"
          ? "(redirect blocked: the route responded with a redirect)"
          : await response.text();
      setResult({
        status: response.type === "opaqueredirect" ? null : response.status,
        statusText: response.statusText,
        durationMs: performance.now() - startedAt,
        body: formatBody(text)
      });
    } catch (err) {
      const durationMs = performance.now() - startedAt;
      if ((err as Error)?.name === "AbortError") {
        setError(
          abortReasonRef.current === "timeout"
            ? `Timed out on the client after ${CLIENT_TIMEOUT_MS / 1000} s (the server may still be running).`
            : "Cancelled on the client (the server may still be running)."
        );
      } else {
        setError(`Request failed: ${(err as Error)?.message ?? String(err)}`);
      }
      setResult({
        status: null,
        statusText: "",
        durationMs,
        body: ""
      });
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setRunning(false);
    }
  }

  function cancel() {
    abortReasonRef.current = "cancel";
    abortRef.current?.abort();
  }

  return (
    <Card
      sx={{
        border: "5px solid #ffb300",
        borderRadius: "8px",
        background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
        color: "#fff"
      }}
    >
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          RUN ANY ROUTE
        </Typography>
        <Typography variant="body2">
          Calls a same-origin /api/ route with your admin session token. GET
          sends query parameters only; POST also sends the optional JSON body.
        </Typography>
        <TextField
          label="Route (path and query)"
          variant="outlined"
          size="small"
          fullWidth
          margin="normal"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          placeholder="/api/v1/db/update-nst-team-daily?runMode=reverse&startDate=2026-09-29&endDate=2026-09-25&overwrite=false"
          disabled={running}
          sx={inputSx}
        />
        <TextField
          select
          label="Method"
          size="small"
          margin="normal"
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          disabled={running}
          sx={{ ...inputSx, minWidth: 120 }}
        >
          <MenuItem value="GET">GET</MenuItem>
          <MenuItem value="POST">POST</MenuItem>
        </TextField>
        {method === "POST" && (
          <TextField
            label="JSON body (optional)"
            variant="outlined"
            size="small"
            fullWidth
            multiline
            minRows={3}
            margin="normal"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={running}
            sx={inputSx}
          />
        )}
        {error && (
          <Typography variant="body2" sx={{ color: "#ff6b6b", mt: 1 }}>
            {error}
          </Typography>
        )}
        {result && (
          <>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Status: {result.status ?? "n/a"} {result.statusText} · Duration:{" "}
              {(result.durationMs / 1000).toFixed(2)} s
            </Typography>
            {result.body && (
              <pre
                style={{
                  maxHeight: 400,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#101010",
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 12
                }}
              >
                {result.body}
              </pre>
            )}
          </>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" onClick={run} disabled={running}>
          {running ? "Running…" : "Run"}
        </Button>
        <Button size="small" onClick={cancel} disabled={!running}>
          Cancel
        </Button>
      </CardActions>
    </Card>
  );
}
