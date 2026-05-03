import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { NextPage } from "next";
import Head from "next/head";

import NewsCard from "components/NewsFeed/NewsCard";
import {
  buildNewsFeedHeadline,
  getTeamOptions,
  normalizeNewsCategory,
  type NewsFeedItem,
  type NewsFeedKeywordPhrase,
} from "lib/newsFeed";
import type { TweetPatternReviewAssignment } from "lib/sources/tweetPatternReview";
import supabase from "lib/supabase";

type ReviewStatus = "pending" | "reviewed" | "ignored";

type PatternCategoryOption = {
  category: string;
  subcategories: string[];
};

type PlayerOption = {
  id: number;
  fullName: string;
  lastName: string;
  position: string | null;
  team_id: number | null;
};

type TweetPatternReviewItem = {
  id: string;
  source_table: string;
  source_group: string | null;
  source_key: string | null;
  source_account: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  source_created_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_url: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  parser_classification: string | null;
  parser_filter_status: string | null;
  parser_filter_reason: string | null;
  keyword_hits: string[] | null;
  review_text: string | null;
  review_status: ReviewStatus;
  review_assignments: TweetPatternReviewAssignment[] | null;
};

type ApiData = {
  success: boolean;
  items: TweetPatternReviewItem[];
  players: PlayerOption[];
  categoryOptions: PatternCategoryOption[];
  message?: string;
};

type EditableAssignment = TweetPatternReviewAssignment & {
  pendingHighlight: string;
  pendingPlayerId: string;
  pendingPlayerName: string;
};

type ReviewNewsApiData = {
  success: boolean;
  items: NewsFeedItem[];
  keywordPhrases: NewsFeedKeywordPhrase[];
  message?: string;
};

type NewsDraft = {
  itemId: string | null;
  headline: string;
  blurb: string;
  category: string;
  subcategory: string;
  teamId: string;
  teamAbbreviation: string;
  playerIds: number[];
  playerNames: string[];
  pendingPlayerId: string;
  pendingPlayerName: string;
};

type KeywordDraft = {
  phrase: string;
  category: string;
  subcategory: string;
  notes: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildAssignmentId(): string {
  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyAssignment(): EditableAssignment {
  return {
    id: buildAssignmentId(),
    category: "",
    subcategory: null,
    playerIds: [],
    playerNames: [],
    highlightPhrases: [],
    notes: null,
    pendingHighlight: "",
    pendingPlayerId: "",
    pendingPlayerName: "",
  };
}

function createEmptyKeywordDraft(): KeywordDraft {
  return {
    phrase: "",
    category: "",
    subcategory: "",
    notes: "",
  };
}

function createEmptyNewsDraft(): NewsDraft {
  return {
    itemId: null,
    headline: "",
    blurb: "",
    category: "",
    subcategory: "",
    teamId: "",
    teamAbbreviation: "",
    playerIds: [],
    playerNames: [],
    pendingPlayerId: "",
    pendingPlayerName: "",
  };
}

function toEditableAssignment(
  assignment: TweetPatternReviewAssignment,
): EditableAssignment {
  return {
    ...assignment,
    pendingHighlight: "",
    pendingPlayerId: "",
    pendingPlayerName: "",
  };
}

async function fetchWithOptionalAuth(url: string): Promise<ApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

async function fetchReviewNewsWithOptionalAuth(
  url: string,
): Promise<ReviewNewsApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

async function postWithOptionalAuth(url: string, body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

function renderHighlightedText(text: string, highlights: string[]) {
  if (highlights.length === 0) return text;

  const uniqueHighlights = Array.from(
    new Set(highlights.map((value) => value.trim()).filter(Boolean)),
  ).sort((left, right) => right.length - left.length);
  if (uniqueHighlights.length === 0) return text;

  const pattern = new RegExp(
    `(${uniqueHighlights.map(escapeRegExp).join("|")})`,
    "gi",
  );
  return text.split(pattern).map((part, index) =>
    uniqueHighlights.some(
      (highlight) => part.toLowerCase() === highlight.toLowerCase(),
    ) ? (
      <mark
        key={index}
        style={{ background: "#f4b942", color: "#111", padding: "0 2px" }}
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

const formControlStyle = {
  background: "#fff",
  color: "#111",
  border: "1px solid #8c8c8c",
  borderRadius: 6,
  padding: "8px 10px",
} satisfies CSSProperties;

const smallButtonStyle = {
  ...formControlStyle,
  padding: "6px 10px",
} satisfies CSSProperties;

const linkStyle = {
  color: "#0b57d0",
} satisfies CSSProperties;

const TweetPatternReviewPage: NextPage = () => {
  const [items, setItems] = useState<TweetPatternReviewItem[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<PatternCategoryOption[]>(
    [],
  );
  const [selectedItemId, setSelectedItemId] = useState("");
  const [assignments, setAssignments] = useState<EditableAssignment[]>([]);
  const [capturedSelection, setCapturedSelection] = useState("");
  const [savedNewsItems, setSavedNewsItems] = useState<NewsFeedItem[]>([]);
  const [savedKeywordPhrases, setSavedKeywordPhrases] = useState<NewsFeedKeywordPhrase[]>([]);
  const [newsDraft, setNewsDraft] = useState<NewsDraft>(createEmptyNewsDraft());
  const [keywordDraft, setKeywordDraft] = useState<KeywordDraft>(createEmptyKeywordDraft());
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">(
    "pending",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNews, setIsSavingNews] = useState(false);
  const [isSavingKeyword, setIsSavingKeyword] = useState(false);

  const loadData = useCallback(
    async (nextStatusFilter = statusFilter) => {
      setIsLoading(true);
      const query = new URLSearchParams({
        status: nextStatusFilter,
        limit: "150",
      });
      const payload = await fetchWithOptionalAuth(
        `/api/v1/db/tweet-pattern-review?${query.toString()}`,
      );
      setItems(payload.items);
      setPlayers(payload.players);
      setCategoryOptions(payload.categoryOptions);
      setSelectedItemId((current) => {
        if (current && payload.items.some((item) => item.id === current)) return current;
        return payload.items[0]?.id ?? "";
      });
      setIsLoading(false);
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadData().catch((error) => {
      setStatusMessage(error.message);
      setIsLoading(false);
    });
  }, [loadData]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );
  const teamOptions = useMemo(() => getTeamOptions(), []);

  useEffect(() => {
    const nextAssignments = selectedItem?.review_assignments?.length
      ? selectedItem.review_assignments.map(toEditableAssignment)
      : [createEmptyAssignment()];
    setAssignments(nextAssignments);
    setCapturedSelection("");
  }, [selectedItem]);

  useEffect(() => {
    const assignmentPlayers = Array.from(
      new Set(
        (selectedItem?.review_assignments ?? [])
          .flatMap((assignment) => assignment.playerNames)
          .filter(Boolean)
      )
    );
    const assignmentPlayerIds = Array.from(
      new Set(
        (selectedItem?.review_assignments ?? []).flatMap((assignment) => assignment.playerIds)
      )
    );
    const primaryAssignment = selectedItem?.review_assignments?.[0] ?? null;
    setNewsDraft({
      itemId: null,
      headline: buildNewsFeedHeadline({
        playerNames: assignmentPlayers,
        category: primaryAssignment?.category ?? selectedItem?.parser_classification,
        subcategory: primaryAssignment?.subcategory ?? null,
        teamAbbreviation: selectedItem?.team_abbreviation ?? null,
      }),
      blurb: "",
      category:
        primaryAssignment?.category ??
        normalizeNewsCategory(selectedItem?.parser_classification) ??
        "",
      subcategory: primaryAssignment?.subcategory ?? "",
      teamId: selectedItem?.team_id ? String(selectedItem.team_id) : "",
      teamAbbreviation: selectedItem?.team_abbreviation ?? "",
      playerIds: assignmentPlayerIds,
      playerNames: assignmentPlayers,
      pendingPlayerId: "",
      pendingPlayerName: "",
    });
    setKeywordDraft({
      phrase: "",
      category:
        primaryAssignment?.category ??
        normalizeNewsCategory(selectedItem?.parser_classification) ??
        "",
      subcategory: primaryAssignment?.subcategory ?? "",
      notes: "",
    });
    setSavedNewsItems([]);
    setSavedKeywordPhrases([]);
    if (!selectedItem?.id) return;
    void fetchReviewNewsWithOptionalAuth(
      `/api/v1/db/news-feed-items?reviewItemId=${encodeURIComponent(selectedItem.id)}&status=all&limit=20`
    )
      .then((payload) => {
        setSavedNewsItems(payload.items);
        setSavedKeywordPhrases(payload.keywordPhrases);
      })
      .catch((error) => setStatusMessage(error.message));
  }, [selectedItem]);

  const currentIndex = selectedItem
    ? items.findIndex((item) => item.id === selectedItem.id)
    : -1;
  const pendingCount = useMemo(
    () => items.filter((item) => item.review_status === "pending").length,
    [items],
  );
  const filteredPlayers = useMemo(() => {
    if (!selectedItem?.team_id) return players;
    const teamPlayers = players.filter(
      (player) => player.team_id === selectedItem.team_id,
    );
    return teamPlayers.length > 0 ? teamPlayers : players;
  }, [players, selectedItem?.team_id]);
  const filteredDraftPlayers = useMemo(() => {
    if (!newsDraft.teamId) return players;
    const teamPlayers = players.filter(
      (player) => String(player.team_id ?? "") === newsDraft.teamId
    );
    return teamPlayers.length > 0 ? teamPlayers : players;
  }, [newsDraft.teamId, players]);

  function moveSelection(direction: -1 | 1) {
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    setSelectedItemId(items[nextIndex].id);
  }

  function updateAssignment(
    assignmentId: string,
    updater: (assignment: EditableAssignment) => EditableAssignment,
  ) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? updater(assignment) : assignment,
      ),
    );
  }

  function addAssignment() {
    setAssignments((current) => [...current, createEmptyAssignment()]);
  }

  function removeAssignment(assignmentId: string) {
    setAssignments((current) =>
      current.length > 1
        ? current.filter((assignment) => assignment.id !== assignmentId)
        : current,
    );
  }

  function addPlayerToAssignment(assignmentId: string) {
    updateAssignment(assignmentId, (assignment) => {
      const selectedPlayer = filteredPlayers.find(
        (player) => String(player.id) === assignment.pendingPlayerId,
      );
      if (!selectedPlayer) return assignment;
      if (assignment.playerIds.includes(selectedPlayer.id)) {
        return { ...assignment, pendingPlayerId: "" };
      }
      return {
        ...assignment,
        playerIds: [...assignment.playerIds, selectedPlayer.id],
        playerNames: [...assignment.playerNames, selectedPlayer.fullName],
        pendingPlayerId: "",
      };
    });
  }

  function addManualPlayerNameToAssignment(assignmentId: string) {
    updateAssignment(assignmentId, (assignment) => {
      const name = assignment.pendingPlayerName.trim();
      if (!name) return assignment;
      if (
        assignment.playerNames.some(
          (playerName) => playerName.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return { ...assignment, pendingPlayerName: "" };
      }
      return {
        ...assignment,
        playerNames: [...assignment.playerNames, name],
        pendingPlayerName: "",
      };
    });
  }

  function removePlayerFromAssignment(
    assignmentId: string,
    playerName: string,
  ) {
    updateAssignment(assignmentId, (assignment) => {
      const playerIndex = assignment.playerNames.findIndex(
        (value) => value === playerName,
      );
      if (playerIndex < 0) return assignment;
      const nextPlayerNames = assignment.playerNames.filter(
        (value) => value !== playerName,
      );
      const nextPlayerIds = [...assignment.playerIds];
      if (playerIndex < nextPlayerIds.length) {
        nextPlayerIds.splice(playerIndex, 1);
      }
      return {
        ...assignment,
        playerIds: nextPlayerIds,
        playerNames: nextPlayerNames,
      };
    });
  }

  function addHighlightToAssignment(
    assignmentId: string,
    phrase: string,
  ) {
    const trimmedPhrase = phrase.trim();
    if (!trimmedPhrase) return;
    updateAssignment(assignmentId, (assignment) => {
      if (
        assignment.highlightPhrases.some(
          (value) => value.toLowerCase() === trimmedPhrase.toLowerCase(),
        )
      ) {
        return { ...assignment, pendingHighlight: "" };
      }
      return {
        ...assignment,
        highlightPhrases: [...assignment.highlightPhrases, trimmedPhrase],
        pendingHighlight: "",
      };
    });
    setCapturedSelection("");
  }

  function applyAssignmentToNewsDraft(assignment: EditableAssignment) {
    setNewsDraft((current) => ({
      ...current,
      itemId: null,
      headline: buildNewsFeedHeadline({
        playerNames: assignment.playerNames,
        category: assignment.category,
        subcategory: assignment.subcategory,
        teamAbbreviation: selectedItem?.team_abbreviation ?? current.teamAbbreviation,
      }),
      category: assignment.category,
      subcategory: assignment.subcategory ?? "",
      teamId: selectedItem?.team_id ? String(selectedItem.team_id) : current.teamId,
      teamAbbreviation: selectedItem?.team_abbreviation ?? current.teamAbbreviation,
      playerIds: assignment.playerIds,
      playerNames: assignment.playerNames,
      pendingPlayerId: "",
      pendingPlayerName: "",
    }));
  }

  function addPlayerToNewsDraft() {
    const selectedPlayer = filteredDraftPlayers.find(
      (player) => String(player.id) === newsDraft.pendingPlayerId,
    );
    if (!selectedPlayer) return;
    if (newsDraft.playerIds.includes(selectedPlayer.id)) {
      setNewsDraft((current) => ({ ...current, pendingPlayerId: "" }));
      return;
    }
    setNewsDraft((current) => ({
      ...current,
      playerIds: [...current.playerIds, selectedPlayer.id],
      playerNames: [...current.playerNames, selectedPlayer.fullName],
      pendingPlayerId: "",
    }));
  }

  function addManualPlayerToNewsDraft() {
    const playerName = newsDraft.pendingPlayerName.trim();
    if (!playerName) return;
    if (
      newsDraft.playerNames.some(
        (existingName) => existingName.toLowerCase() === playerName.toLowerCase(),
      )
    ) {
      setNewsDraft((current) => ({ ...current, pendingPlayerName: "" }));
      return;
    }
    setNewsDraft((current) => ({
      ...current,
      playerNames: [...current.playerNames, playerName],
      pendingPlayerName: "",
    }));
  }

  function removePlayerFromNewsDraft(playerName: string) {
    setNewsDraft((current) => {
      const playerIndex = current.playerNames.findIndex((value) => value === playerName);
      if (playerIndex < 0) return current;
      const nextPlayerNames = current.playerNames.filter((value) => value !== playerName);
      const nextPlayerIds = [...current.playerIds];
      if (playerIndex < nextPlayerIds.length) {
        nextPlayerIds.splice(playerIndex, 1);
      }
      return {
        ...current,
        playerNames: nextPlayerNames,
        playerIds: nextPlayerIds,
      };
    });
  }

  function removeHighlightFromAssignment(
    assignmentId: string,
    phrase: string,
  ) {
    updateAssignment(assignmentId, (assignment) => ({
      ...assignment,
      highlightPhrases: assignment.highlightPhrases.filter(
        (value) => value !== phrase,
      ),
    }));
  }

  async function syncQueue() {
    setIsSyncing(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/tweet-pattern-review", {
        action: "sync",
        perSourceLimit: 200,
      });
      setStatusMessage(payload.message ?? "Queue synced.");
      await loadData(statusFilter);
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function saveReview() {
    if (!selectedItem) return;
    const cleanedAssignments = assignments
      .map((assignment) => ({
        id: assignment.id,
        category: assignment.category.trim(),
        subcategory: assignment.subcategory?.trim() || null,
        playerIds: assignment.playerIds,
        playerNames: assignment.playerNames.map((name) => name.trim()).filter(Boolean),
        highlightPhrases: assignment.highlightPhrases
          .map((phrase) => phrase.trim())
          .filter(Boolean),
        notes: assignment.notes?.trim() || null,
      }))
      .filter((assignment) => assignment.category);

    if (cleanedAssignments.length === 0) {
      setStatusMessage("Add at least one assignment before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/tweet-pattern-review", {
        itemId: selectedItem.id,
        reviewAssignments: cleanedAssignments,
      });
      setStatusMessage(payload.message ?? "Review saved.");
      await loadData(statusFilter);
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateReviewStatus(action: "ignore" | "requeue") {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/tweet-pattern-review", {
        action,
        itemId: selectedItem.id,
      });
      setStatusMessage(payload.message ?? "Status updated.");
      await loadData(statusFilter);
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveNewsCard(cardStatus: "draft" | "published") {
    if (!selectedItem) return;
    if (!newsDraft.headline.trim() || !newsDraft.category.trim()) {
      setStatusMessage("News card headline and category are required.");
      return;
    }

    const normalizedCategory = normalizeNewsCategory(newsDraft.category);
    const normalizedSubcategory = normalizeNewsCategory(newsDraft.subcategory);
    const teamOption = teamOptions.find((team) => String(team.id) === newsDraft.teamId);

    setIsSavingNews(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/news-feed-items", {
        action: "saveCard",
        itemId: newsDraft.itemId,
        sourceReviewItemId: selectedItem.id,
        sourceTweetId: selectedItem.tweet_id,
        sourceUrl: selectedItem.source_url,
        tweetUrl: selectedItem.tweet_url,
        sourceLabel: selectedItem.source_label,
        sourceAccount: selectedItem.source_account,
        observedAt: selectedItem.source_created_at,
        teamId: teamOption?.id ?? (selectedItem.team_id ?? null),
        teamAbbreviation:
          teamOption?.abbreviation ??
          newsDraft.teamAbbreviation ??
          selectedItem.team_abbreviation,
        headline: newsDraft.headline,
        blurb: newsDraft.blurb,
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        cardStatus,
        playerAssignments: newsDraft.playerNames.map((playerName, index) => ({
          playerId: newsDraft.playerIds[index] ?? null,
          playerName,
          teamId: teamOption?.id ?? selectedItem.team_id ?? null,
        })),
        metadata: {
          parserClassification: selectedItem.parser_classification,
          parserFilterStatus: selectedItem.parser_filter_status,
        },
      });
      setStatusMessage(payload.message ?? "News card saved.");
      const refreshed = await fetchReviewNewsWithOptionalAuth(
        `/api/v1/db/news-feed-items?reviewItemId=${encodeURIComponent(selectedItem.id)}&status=all&limit=20`
      );
      setSavedNewsItems(refreshed.items);
      setSavedKeywordPhrases(refreshed.keywordPhrases);
      setNewsDraft((current) => ({
        ...current,
        itemId: payload.itemId ?? current.itemId,
      }));
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setIsSavingNews(false);
    }
  }

  async function saveKeywordPhrase() {
    if (!selectedItem) return;
    if (!keywordDraft.phrase.trim()) {
      setStatusMessage("Keyword phrase is required.");
      return;
    }

    setIsSavingKeyword(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/news-feed-items", {
        action: "saveKeywordPhrase",
        sourceReviewItemId: selectedItem.id,
        phrase: keywordDraft.phrase,
        category: keywordDraft.category,
        subcategory: keywordDraft.subcategory,
        notes: keywordDraft.notes,
      });
      setStatusMessage(payload.message ?? "Keyword phrase saved.");
      const refreshed = await fetchReviewNewsWithOptionalAuth(
        `/api/v1/db/news-feed-items?reviewItemId=${encodeURIComponent(selectedItem.id)}&status=all&limit=20`
      );
      setSavedKeywordPhrases(refreshed.keywordPhrases);
      setKeywordDraft(createEmptyKeywordDraft());
    } catch (error: any) {
      setStatusMessage(error.message);
    } finally {
      setIsSavingKeyword(false);
    }
  }

  return (
    <>
      <Head>
        <title>Tweet Pattern Review | FHFH</title>
      </Head>
      <main style={{ margin: "0 auto", maxWidth: 1280, padding: 24, color: "#f5f5f5" }}>
        <h1>Tweet Pattern Review</h1>
        <p>
          Review tweets one by one, add one or more assignments per tweet, and mark
          the exact evidence text that justifies each assignment.
        </p>
        {statusMessage ? <p>{statusMessage}</p> : null}

        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0, 2.2fr) minmax(320px, 1fr)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "end",
                padding: 16,
                border: "1px solid #d7d7d7",
                borderRadius: 12,
                color: "#f5f5f5",
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                Review status
                <select
                  style={formControlStyle}
                  value={statusFilter}
                  onChange={(event) => {
                    const nextFilter = event.target.value as ReviewStatus | "all";
                    setStatusFilter(nextFilter);
                    void loadData(nextFilter).catch((error) =>
                      setStatusMessage(error.message),
                    );
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="ignored">Ignored</option>
                  <option value="all">All</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, minWidth: 320 }}>
                Queue item
                <select
                  style={formControlStyle}
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  disabled={items.length === 0}
                >
                  {items.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {index + 1}. {item.source_account ?? item.source_key ?? item.source_table} ·{" "}
                      {item.team_abbreviation ?? "No team"} · {item.tweet_id ?? "No tweet id"}
                    </option>
                  ))}
                </select>
              </label>

              <button
                style={formControlStyle}
                disabled={isSyncing}
                onClick={() => void syncQueue()}
              >
                {isSyncing ? "Syncing..." : "Sync corpus queue"}
              </button>

              <div>
                <strong>{pendingCount}</strong> pending in current filter
              </div>
            </div>

            {isLoading ? <p>Loading...</p> : null}
            {!isLoading && !selectedItem ? (
              <p>No tweets are currently loaded for this review filter.</p>
            ) : null}

            {selectedItem ? (
              <article
                style={{
                  display: "grid",
                  gap: 16,
                  padding: 20,
                  border: "1px solid #d7d7d7",
                  borderRadius: 16,
                  background: "#fffaf3",
                  color: "#111",
                }}
              >
                <header style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span>
                      <strong>Source:</strong>{" "}
                      {selectedItem.source_account ??
                        selectedItem.source_key ??
                        selectedItem.source_table}
                    </span>
                    <span>
                      <strong>Team:</strong> {selectedItem.team_abbreviation ?? "Unknown"}
                    </span>
                    <span>
                      <strong>Parser:</strong> {selectedItem.parser_classification ?? "None"}
                    </span>
                    <span>
                      <strong>Filter:</strong> {selectedItem.parser_filter_status ?? "None"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <span>{formatTimestamp(selectedItem.source_created_at)}</span>
                    {selectedItem.source_url ? (
                      <a href={selectedItem.source_url} style={linkStyle}>
                        Open source tweet
                      </a>
                    ) : null}
                    {selectedItem.tweet_url && selectedItem.tweet_url !== selectedItem.source_url ? (
                      <a href={selectedItem.tweet_url} style={linkStyle}>
                        Open tweet URL
                      </a>
                    ) : null}
                    {selectedItem.quoted_tweet_url ? (
                      <a href={selectedItem.quoted_tweet_url} style={linkStyle}>
                        Open quoted tweet
                      </a>
                    ) : null}
                  </div>
                  {selectedItem.keyword_hits && selectedItem.keyword_hits.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedItem.keyword_hits.map((keyword) => (
                        <span
                          key={keyword}
                          style={{
                            border: "1px solid #c7c7c7",
                            borderRadius: 999,
                            padding: "4px 10px",
                            background: "#f3f3f3",
                            color: "#222",
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </header>

                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    minHeight: 240,
                    whiteSpace: "pre-wrap",
                    background: "#111",
                    color: "#f7f0df",
                    borderRadius: 12,
                    fontSize: 15,
                    lineHeight: 1.55,
                  }}
                  onMouseUp={(event) => {
                    const selection = window.getSelection();
                    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                      setCapturedSelection("");
                      return;
                    }
                    const range = selection.getRangeAt(0);
                    if (!event.currentTarget.contains(range.commonAncestorContainer)) {
                      setCapturedSelection("");
                      return;
                    }
                    setCapturedSelection(selection.toString().trim());
                  }}
                >
                  {renderHighlightedText(
                    selectedItem.review_text ?? "No tweet text captured.",
                    assignments.flatMap((assignment) => assignment.highlightPhrases),
                  )}
                </pre>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>Assignments</strong>
                  <button style={smallButtonStyle} onClick={() => addAssignment()}>
                    Add assignment
                  </button>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {assignments.map((assignment, index) => {
                    const selectedCategoryOption =
                      categoryOptions.find(
                        (option) =>
                          option.category.toLowerCase() ===
                          assignment.category.trim().toLowerCase(),
                      ) ?? null;

                    return (
                      <section
                        key={assignment.id}
                        style={{
                          display: "grid",
                          gap: 12,
                          padding: 14,
                          border: "1px solid #d8cfbf",
                          borderRadius: 12,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <strong>Assignment {index + 1}</strong>
                          <button
                            style={smallButtonStyle}
                            disabled={assignments.length <= 1}
                            onClick={() => removeAssignment(assignment.id)}
                          >
                            Remove assignment
                          </button>
                        </div>
                        <div>
                          <button
                            style={smallButtonStyle}
                            onClick={() => applyAssignmentToNewsDraft(assignment)}
                          >
                            Use for news card
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                          }}
                        >
                          <label style={{ display: "grid", gap: 6 }}>
                            Category
                            <input
                              style={formControlStyle}
                              list="tweet-pattern-categories"
                              value={assignment.category}
                              onChange={(event) =>
                                updateAssignment(assignment.id, (current) => ({
                                  ...current,
                                  category: event.target.value,
                                }))
                              }
                              placeholder="INJURY, GOALIE START, LINE COMBINATION..."
                            />
                          </label>

                          <label style={{ display: "grid", gap: 6 }}>
                            Subcategory
                            <input
                              style={formControlStyle}
                              list={`tweet-pattern-subcategories-${assignment.id}`}
                              value={assignment.subcategory ?? ""}
                              onChange={(event) =>
                                updateAssignment(assignment.id, (current) => ({
                                  ...current,
                                  subcategory: event.target.value || null,
                                }))
                              }
                              placeholder="POWER PLAY, QUESTIONABLE, CONFIRMED STARTER..."
                            />
                          </label>
                        </div>

                        <datalist id="tweet-pattern-categories">
                          {categoryOptions.map((option) => (
                            <option key={option.category} value={option.category} />
                          ))}
                        </datalist>
                        <datalist id={`tweet-pattern-subcategories-${assignment.id}`}>
                          {(selectedCategoryOption?.subcategories ?? []).map((subcategory) => (
                            <option key={subcategory} value={subcategory} />
                          ))}
                        </datalist>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                          }}
                        >
                          <label style={{ display: "grid", gap: 6 }}>
                            Assign player from roster
                            <select
                              style={formControlStyle}
                              value={assignment.pendingPlayerId}
                              onChange={(event) =>
                                updateAssignment(assignment.id, (current) => ({
                                  ...current,
                                  pendingPlayerId: event.target.value,
                                }))
                              }
                            >
                              <option value="">Choose a player...</option>
                              {filteredPlayers.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.fullName}
                                  {player.position ? ` - ${player.position}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            style={smallButtonStyle}
                            disabled={!assignment.pendingPlayerId}
                            onClick={() => addPlayerToAssignment(assignment.id)}
                          >
                            Add player
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                          }}
                        >
                          <label style={{ display: "grid", gap: 6 }}>
                            Or add player text manually
                            <input
                              style={formControlStyle}
                              value={assignment.pendingPlayerName}
                              onChange={(event) =>
                                updateAssignment(assignment.id, (current) => ({
                                  ...current,
                                  pendingPlayerName: event.target.value,
                                }))
                              }
                              placeholder="Player name or shorthand"
                            />
                          </label>
                          <button
                            style={smallButtonStyle}
                            disabled={!assignment.pendingPlayerName.trim()}
                            onClick={() => addManualPlayerNameToAssignment(assignment.id)}
                          >
                            Add manual name
                          </button>
                        </div>

                        {assignment.playerNames.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {assignment.playerNames.map((playerName) => (
                              <button
                                key={`${assignment.id}-${playerName}`}
                                style={{
                                  ...smallButtonStyle,
                                  border: "1px solid #b6d3a4",
                                  background: "#edf8e5",
                                }}
                                onClick={() =>
                                  removePlayerFromAssignment(assignment.id, playerName)
                                }
                              >
                                {playerName} ×
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0 }}>No players assigned yet.</p>
                        )}

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, auto))",
                            alignItems: "end",
                          }}
                        >
                          <button
                            style={smallButtonStyle}
                            disabled={!capturedSelection}
                            onClick={() =>
                              addHighlightToAssignment(assignment.id, capturedSelection)
                            }
                          >
                            Add selected text as evidence
                          </button>
                          <label style={{ display: "grid", gap: 6 }}>
                            Manual evidence phrase
                            <input
                              style={formControlStyle}
                              value={assignment.pendingHighlight}
                              onChange={(event) =>
                                updateAssignment(assignment.id, (current) => ({
                                  ...current,
                                  pendingHighlight: event.target.value,
                                }))
                              }
                              placeholder="Expected starter, day to day, PP1, etc."
                            />
                          </label>
                          <button
                            style={smallButtonStyle}
                            disabled={!assignment.pendingHighlight.trim()}
                            onClick={() =>
                              addHighlightToAssignment(
                                assignment.id,
                                assignment.pendingHighlight,
                              )
                            }
                          >
                            Add phrase
                          </button>
                        </div>

                        {assignment.highlightPhrases.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {assignment.highlightPhrases.map((phrase) => (
                              <button
                                key={`${assignment.id}-${phrase}`}
                                style={{
                                  ...smallButtonStyle,
                                  border: "1px solid #d6b25b",
                                  background: "#fff3d0",
                                }}
                                onClick={() =>
                                  removeHighlightFromAssignment(assignment.id, phrase)
                                }
                              >
                                {phrase} ×
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0 }}>No evidence text selected for this assignment.</p>
                        )}

                        <label style={{ display: "grid", gap: 6 }}>
                          Assignment notes
                          <textarea
                            style={formControlStyle}
                            rows={3}
                            value={assignment.notes ?? ""}
                            onChange={(event) =>
                              updateAssignment(assignment.id, (current) => ({
                                ...current,
                                notes: event.target.value || null,
                              }))
                            }
                            placeholder="Optional reasoning, regex idea, or ambiguity note."
                          />
                        </label>
                      </section>
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    style={formControlStyle}
                    disabled={currentIndex <= 0}
                    onClick={() => moveSelection(-1)}
                  >
                    Previous tweet
                  </button>
                  <button
                    style={formControlStyle}
                    disabled={currentIndex < 0 || currentIndex >= items.length - 1}
                    onClick={() => moveSelection(1)}
                  >
                    Next tweet
                  </button>
                  <button
                    style={formControlStyle}
                    disabled={isSaving}
                    onClick={() => void updateReviewStatus("ignore")}
                  >
                    Ignore tweet
                  </button>
                  <button
                    style={formControlStyle}
                    disabled={isSaving}
                    onClick={() => void updateReviewStatus("requeue")}
                  >
                    Requeue
                  </button>
                  <button
                    style={formControlStyle}
                    disabled={isSaving}
                    onClick={() => void saveReview()}
                  >
                    {isSaving ? "Saving..." : "Save assignments"}
                  </button>
                </div>

                <section
                  style={{
                    display: "grid",
                    gap: 16,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(0,0,0,0.12)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>News card composer</strong>
                    <a href="/news" style={linkStyle} target="_blank" rel="noreferrer">
                      Open /news
                    </a>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6 }}>
                      Headline
                      <input
                        style={formControlStyle}
                        value={newsDraft.headline}
                        onChange={(event) =>
                          setNewsDraft((current) => ({
                            ...current,
                            headline: event.target.value,
                          }))
                        }
                        placeholder="Write the card headline"
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Team
                      <select
                        style={formControlStyle}
                        value={newsDraft.teamId}
                        onChange={(event) => {
                          const team = teamOptions.find((option) => String(option.id) === event.target.value);
                          setNewsDraft((current) => ({
                            ...current,
                            teamId: event.target.value,
                            teamAbbreviation: team?.abbreviation ?? "",
                          }));
                        }}
                      >
                        <option value="">Choose a team...</option>
                        {teamOptions.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Category
                      <input
                        style={formControlStyle}
                        list="tweet-pattern-categories"
                        value={newsDraft.category}
                        onChange={(event) =>
                          setNewsDraft((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        placeholder="INJURY, RETURN, GOALIE START..."
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Subcategory
                      <input
                        style={formControlStyle}
                        value={newsDraft.subcategory}
                        onChange={(event) =>
                          setNewsDraft((current) => ({
                            ...current,
                            subcategory: event.target.value,
                          }))
                        }
                        placeholder="QUESTIONABLE, PP1, TRADE, etc."
                      />
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 6 }}>
                    Blurb
                    <textarea
                      style={formControlStyle}
                      rows={4}
                      value={newsDraft.blurb}
                      onChange={(event) =>
                        setNewsDraft((current) => ({
                          ...current,
                          blurb: event.target.value,
                        }))
                      }
                      placeholder="Write the distilled Rotowire-style blurb for this update."
                    />
                  </label>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6 }}>
                      Add player from roster
                      <select
                        style={formControlStyle}
                        value={newsDraft.pendingPlayerId}
                        onChange={(event) =>
                          setNewsDraft((current) => ({
                            ...current,
                            pendingPlayerId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a player...</option>
                        {filteredDraftPlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.fullName}
                            {player.position ? ` - ${player.position}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      style={smallButtonStyle}
                      disabled={!newsDraft.pendingPlayerId}
                      onClick={() => addPlayerToNewsDraft()}
                    >
                      Add player
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6 }}>
                      Add manual player text
                      <input
                        style={formControlStyle}
                        value={newsDraft.pendingPlayerName}
                        onChange={(event) =>
                          setNewsDraft((current) => ({
                            ...current,
                            pendingPlayerName: event.target.value,
                          }))
                        }
                        placeholder="Prospect, unsigned player, shorthand, etc."
                      />
                    </label>
                    <button
                      style={smallButtonStyle}
                      disabled={!newsDraft.pendingPlayerName.trim()}
                      onClick={() => addManualPlayerToNewsDraft()}
                    >
                      Add manual name
                    </button>
                  </div>

                  {newsDraft.playerNames.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {newsDraft.playerNames.map((playerName) => (
                        <button
                          key={`news-draft-${playerName}`}
                          style={{
                            ...smallButtonStyle,
                            border: "1px solid #b6d3a4",
                            background: "#edf8e5",
                          }}
                          onClick={() => removePlayerFromNewsDraft(playerName)}
                        >
                          {playerName} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0 }}>No players attached to this card yet.</p>
                  )}

                  <div style={{ display: "grid", gap: 12 }}>
                    <strong>Card preview</strong>
                    <NewsCard
                      item={{
                        headline: newsDraft.headline || "Draft headline",
                        blurb:
                          newsDraft.blurb || "Write a concise fantasy-news blurb for this update.",
                        category: normalizeNewsCategory(newsDraft.category) || "UPDATE",
                        subcategory: normalizeNewsCategory(newsDraft.subcategory) || null,
                        team_abbreviation:
                          newsDraft.teamAbbreviation || selectedItem.team_abbreviation,
                        source_label: selectedItem.source_label,
                        source_account: selectedItem.source_account,
                        source_url: selectedItem.source_url,
                        published_at: null,
                        created_at: new Date().toISOString(),
                        card_status: "draft",
                        players: newsDraft.playerNames.map((playerName, index) => ({
                          id: `${playerName}-${index}`,
                          news_item_id: "draft",
                          player_id: newsDraft.playerIds[index] ?? null,
                          player_name: playerName,
                          team_id: Number(newsDraft.teamId) || selectedItem.team_id,
                          role: "subject",
                        })),
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <button
                      style={formControlStyle}
                      disabled={isSavingNews}
                      onClick={() => void saveNewsCard("draft")}
                    >
                      {isSavingNews ? "Saving..." : "Save draft card"}
                    </button>
                    <button
                      style={formControlStyle}
                      disabled={isSavingNews}
                      onClick={() => void saveNewsCard("published")}
                    >
                      {isSavingNews ? "Saving..." : "Publish card"}
                    </button>
                  </div>

                  {savedNewsItems.length > 0 ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <strong>Saved cards for this tweet</strong>
                      {savedNewsItems.map((item) => (
                        <div key={item.id} style={{ display: "grid", gap: 8 }}>
                          <NewsCard item={item} />
                          <button
                            style={smallButtonStyle}
                            onClick={() =>
                              setNewsDraft({
                                itemId: item.id,
                                headline: item.headline,
                                blurb: item.blurb,
                                category: item.category,
                                subcategory: item.subcategory ?? "",
                                teamId: item.team_id ? String(item.team_id) : "",
                                teamAbbreviation: item.team_abbreviation ?? "",
                                playerIds: item.players.map((player) => player.player_id ?? 0).filter(Boolean),
                                playerNames: item.players.map((player) => player.player_name),
                                pendingPlayerId: "",
                                pendingPlayerName: "",
                              })
                            }
                          >
                            Load into composer
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section
                  style={{
                    display: "grid",
                    gap: 16,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(0,0,0,0.12)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>Novel keyword phrases</strong>
                    <span style={{ color: "#666" }}>
                      Add phrases that should later feed auto-flagging, even if they are not exact tweet text.
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6 }}>
                      Phrase
                      <input
                        style={formControlStyle}
                        value={keywordDraft.phrase}
                        onChange={(event) =>
                          setKeywordDraft((current) => ({
                            ...current,
                            phrase: event.target.value,
                          }))
                        }
                        placeholder="Projected starter, no contact jersey, PP1..."
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Category
                      <input
                        style={formControlStyle}
                        value={keywordDraft.category}
                        onChange={(event) =>
                          setKeywordDraft((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        placeholder="GOALIE START, INJURY, LINE COMBINATION..."
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      Subcategory
                      <input
                        style={formControlStyle}
                        value={keywordDraft.subcategory}
                        onChange={(event) =>
                          setKeywordDraft((current) => ({
                            ...current,
                            subcategory: event.target.value,
                          }))
                        }
                        placeholder="QUESTIONABLE, PP1, EXPECTED STARTER..."
                      />
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 6 }}>
                    Notes
                    <textarea
                      style={formControlStyle}
                      rows={3}
                      value={keywordDraft.notes}
                      onChange={(event) =>
                        setKeywordDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Optional comment about when this phrase should or should not trigger."
                    />
                  </label>

                  <div>
                    <button
                      style={formControlStyle}
                      disabled={isSavingKeyword}
                      onClick={() => void saveKeywordPhrase()}
                    >
                      {isSavingKeyword ? "Saving..." : "Save keyword phrase"}
                    </button>
                  </div>

                  {savedKeywordPhrases.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {savedKeywordPhrases.map((phrase) => (
                        <span
                          key={phrase.id}
                          style={{
                            border: "1px solid #d4d4d4",
                            borderRadius: 999,
                            padding: "6px 10px",
                            background: "#fafafa",
                            color: "#222",
                          }}
                        >
                          {phrase.phrase}
                          {phrase.category ? ` · ${phrase.category}` : ""}
                          {phrase.subcategory ? ` · ${phrase.subcategory}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0 }}>No manual keyword phrases saved for this tweet yet.</p>
                  )}
                </section>
              </article>
            ) : null}
          </div>

          <aside
            style={{
              display: "grid",
              gap: 12,
              padding: 16,
              border: "1px solid #d7d7d7",
              borderRadius: 12,
              background: "#f8f8f8",
              color: "#111",
            }}
          >
            <h2 style={{ margin: 0 }}>Review guide</h2>
            <p style={{ margin: 0 }}>
              One tweet can contain several assignments. Use separate blocks when a tweet
              mixes lines, goalie starts, injuries, scratches, or returns.
            </p>
            <p style={{ margin: 0 }}>
              Add specific players to the assignment when the tweet points to them. For
              injuries, this is the main way to tie the status note to the correct player.
            </p>
            <p style={{ margin: 0 }}>
              Use <strong>OTHER / NON NHL</strong> when the tweet is a useful non-NHL example
              you want counted in the analysis set. Use <strong>Ignore</strong> only for
              duplicates, junk, or rows you do not want included at all.
            </p>
            {selectedItem?.parser_filter_reason ? (
              <p style={{ margin: 0 }}>
                <strong>Current parser reason:</strong> {selectedItem.parser_filter_reason}
              </p>
            ) : null}
          </aside>
        </section>
      </main>
    </>
  );
};

export default TweetPatternReviewPage;
