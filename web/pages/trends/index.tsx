import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";

type PlayerListItem = {
  id: number;
  fullName: string;
  position: string;
  team_abbrev: string | null;
};

export default function TrendsIndexPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerListItem[]>([]);
  const [suggestions, setSuggestions] = useState<PlayerListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = "player-suggestions";
  const teamIdToAbbrev = useMemo(() => {
    const map: Record<number, string> = {};
    Object.values(teamsInfo).forEach((t) => {
      map[t.id] = t.abbrev;
    });
    return map;
  }, []);

  const disabled = useMemo(
    () => loading || query.trim().length < 2,
    [loading, query]
  );

  // Normalize name parts to Title Case to better match stored fullName values
  const normalizeName = (str: string) =>
    str
      .trim()
      .split(/\s+/)
      .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1).toLowerCase())
      .join(" ");

  // Debounced autocomplete fetch
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const normalized = normalizeName(q);
        const { data, error } = await (supabase as any)
          .from("players")
          .select("id, fullName, position, team_id")
          .ilike("fullName", `%${normalized}%`)
          .order("fullName", { ascending: true })
          .limit(8);

        if (error) throw error;

        const mapped = ((data as any[]) ?? []).map((row: any) => ({
          id: row.id,
          fullName: row.fullName,
          position: row.position,
          team_abbrev:
            row.team_id != null ? (teamIdToAbbrev[row.team_id] ?? null) : null
        })) as PlayerListItem[];

        setSuggestions(mapped);
        setShowSuggestions(mapped.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        console.error(err);
        // Don't show global error for autocomplete; keep suggestions hidden instead
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [query]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const trimmedQuery = query.trim();
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const normalized = normalizeName(trimmedQuery);

      const { data, error } = await (supabase as any)
        .from("players")
        .select("id, fullName, position, team_id")
        .ilike("fullName", `%${normalized}%`)
        .order("fullName", { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        setError("No players found. Try another name.");
        return;
      }

      setResults(
        ((data as any[]) ?? []).map((row: any) => ({
          id: row.id,
          fullName: row.fullName,
          position: row.position,
          team_abbrev:
            row.team_id != null ? (teamIdToAbbrev[row.team_id] ?? null) : null
        })) as PlayerListItem[]
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unexpected error searching players.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[activeIndex];
        router.push(`/trends/player/${chosen.id}`);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-8 px-4 text-center">
      <section>
        <h1 className="text-3xl font-semibold text-slate-900">
          Sustainability Trends
        </h1>
        <p className="mt-3 text-slate-600">
          Search for an NHL skater to explore rolling metrics and form
          indicators.
        </p>
      </section>

      <form
        onSubmit={handleSearch}
        className="flex w-full max-w-xl flex-col gap-4"
      >
        <div className="relative text-left">
          <input
            ref={inputRef}
            type="text"
            autoFocus
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={listboxId}
            aria-autocomplete="list"
            placeholder="Search by player name (e.g., Connor McDavid)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {suggestions.map((player, idx) => (
                <li
                  key={player.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                >
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                      idx === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                    onMouseDown={(e) => {
                      // Use mousedown so selection happens before input blur
                      e.preventDefault();
                      router.push(`/trends/player/${player.id}`);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="font-medium text-slate-800">
                      {player.fullName}
                    </span>
                    <span className="text-sm text-slate-500">
                      {player.team_abbrev ?? "FA"} · {player.position}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled}
          className={`rounded-lg px-4 py-3 text-white transition ${
            disabled
              ? "cursor-not-allowed bg-blue-300"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Searching…" : "Find Player"}
        </button>
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!error && results.length > 0 && (
        <div className="w-full max-w-xl">
          <h2 className="mb-3 text-left text-sm font-medium text-slate-500">
            Select a player
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            {results.map((player) => (
              <li
                key={player.id}
                className="border-t border-slate-100 first:border-t-0"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/trends/player/${player.id}`)}
                  className="flex w-full justify-between px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
                >
                  <span className="font-medium text-slate-800">
                    {player.fullName}
                  </span>
                  <span className="text-sm text-slate-500">
                    {player.team_abbrev ?? "FA"} · {player.position}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Looking for classic sustainability tables?{" "}
        <button
          type="button"
          onClick={() => router.push("/trends/legacy")}
          className="text-blue-600 underline"
        >
          View legacy dashboard
        </button>
      </p>
    </div>
  );
}
