import React, { useState, useRef, useEffect, useId } from "react";
import supabase from "lib/supabase";
import Link from "next/link";

interface PlayerResult {
  id: number;
  fullName: string;
  image_url: string | null;
  team_id: number | null;
}

export default function PlayerSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pendingFocusRef = useRef<number | null>(null);
  const searchId = useId();
  const resultsId = `${searchId}-results`;

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (showDropdown && pendingFocusRef.current !== null) {
      resultRefs.current[pendingFocusRef.current]?.focus();
      pendingFocusRef.current = null;
    }
  }, [showDropdown]);

  const updateQuery = (value: string) => {
    const requestId = ++requestRef.current;
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setResults([]);
    if (value.length < 2) {
      setStatus("idle");
      setShowDropdown(false);
      return;
    }
    setStatus("loading");
    setShowDropdown(true);
    timeoutRef.current = setTimeout(async () => {
      timeoutRef.current = null;
      try {
        const { data, error } = await supabase
          .from("players")
          .select("id, fullName, image_url, team_id")
          .ilike("fullName", `%${value}%`)
          .limit(10);
        if (requestId !== requestRef.current) return;
        if (error) throw error;
        setResults((data as PlayerResult[]) || []);
        setStatus("success");
      } catch {
        if (requestId !== requestRef.current) return;
        setResults([]);
        setStatus("error");
      }
    }, 200);
  };

  const statusMessage = !showDropdown ? "" : status === "loading"
    ? "Searching players…"
    : status === "error"
      ? "Unable to search players. Please try again."
      : status === "success" && results.length === 0 ? "No players found." : "";

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setShowDropdown(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          inputRef.current?.focus();
          setShowDropdown(false);
        }
      }}
      style={{
        position: "relative",
        maxWidth: 400,
        margin: "0 auto 2rem auto"
      }}
    >
      <label
        htmlFor={searchId}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}
      >
        Search players
      </label>
      <input
        ref={inputRef}
        id={searchId}
        type="text"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        aria-controls={showDropdown && results.length > 0 ? resultsId : undefined}
        autoComplete="off"
        enterKeyHint="search"
        inputMode="search"
        placeholder="Search for a player..."
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid #ccc"
        }}
        onFocus={() => query.length > 1 && setShowDropdown(true)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length > 0) {
            event.preventDefault();
            const index = event.key === "ArrowDown" ? 0 : results.length - 1;
            if (showDropdown) resultRefs.current[index]?.focus();
            else {
              pendingFocusRef.current = index;
              setShowDropdown(true);
            }
          }
        }}
      />
      <div role="status" style={{ color: "inherit", padding: statusMessage ? "0.5rem 0" : 0 }}>
        {statusMessage}
      </div>
      {showDropdown && results.length > 0 && (
        <ul
          id={resultsId}
          aria-label="Player search results"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 6,
            margin: 0,
            padding: 0,
            zIndex: 10,
            listStyle: "none",
            maxHeight: 300,
            overflowY: "auto"
          }}
        >
          {results.map((player, index) => (
            <li key={player.id}>
              <Link
                ref={(element) => { resultRefs.current[index] = element; }}
                href={`/stats/player/${player.id}`}
                prefetch={false}
                onClick={(event) => {
                  if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                    updateQuery("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const nextIndex = index + (event.key === "ArrowDown" ? 1 : -1);
                    if (nextIndex < 0 || nextIndex >= results.length) inputRef.current?.focus();
                    else resultRefs.current[nextIndex]?.focus();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem 1rem",
                  color: "inherit",
                  textDecoration: "none",
                  borderBottom: "1px solid #333"
                }}
              >
                {player.image_url && (
                  <img
                    src={player.image_url}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      marginRight: 12,
                      objectFit: "cover"
                    }}
                  />
                )}
                <span>{player.fullName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
