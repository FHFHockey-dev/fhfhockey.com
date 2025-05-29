import React, { useState, useRef, useEffect } from "react";
import supabase from "lib/supabase";
import { useRouter } from "next/router";

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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (e.target.value.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("players")
        .select("id, fullName, image_url, team_id")
        .ilike("fullName", `%${e.target.value}%`)
        .limit(10);
      setResults((data as PlayerResult[]) || []);
      setShowDropdown(true);
    }, 200);
  };

  const handleSelect = (playerId: number) => {
    setQuery("");
    setShowDropdown(false);
    router.push(`/stats/player/${playerId}`);
  };

  return (
    <div
      style={{
        position: "relative",
        maxWidth: 400,
        margin: "0 auto 2rem auto"
      }}
    >
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Search for a player..."
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid #ccc"
        }}
        onFocus={() => query.length > 1 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {mounted && showDropdown && results.length > 0 && (
        <ul
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
          {results.map((player) => (
            <li
              key={player.id}
              onMouseDown={() => handleSelect(player.id)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.5rem 1rem",
                cursor: "pointer",
                borderBottom: "1px solid #333"
              }}
            >
              {player.image_url && (
                <img
                  src={player.image_url}
                  alt={player.fullName}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
