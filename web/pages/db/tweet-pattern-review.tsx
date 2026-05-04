import { useCallback, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";

import styles from "./tweet-pattern-review.module.scss";

import NewsCard from "components/NewsFeed/NewsCard";
import {
  buildNewsFeedHeadline,
  formatNewsFeedLabel,
  getTeamOptions,
  normalizeNewsCategory,
  type NewsFeedItem,
  type NewsFeedKeywordPhrase
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
  raw_text?: string | null;
  enriched_text?: string | null;
  quoted_text?: string | null;
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

type AuthorLookupApiData = {
  success: boolean;
  authorName: string | null;
  authorHandle: string | null;
  message?: string;
};

type AuthorOverride = {
  authorName: string | null;
  authorHandle: string | null;
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
    pendingPlayerName: ""
  };
}

function createEmptyKeywordDraft(): KeywordDraft {
  return {
    phrase: "",
    category: "",
    subcategory: "",
    notes: ""
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
    pendingPlayerName: ""
  };
}

function normalizeSourceHandle(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function parseHandleFromTweetUrl(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.includes("twitter.com") && !hostname.includes("x.com")) {
      return null;
    }
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? null;
    return normalizeSourceHandle(handle);
  } catch {
    return null;
  }
}

function pickLongestText(
  ...values: Array<string | null | undefined>
): string | null {
  let longestValue: string | null = null;
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) continue;
    if (!longestValue || trimmed.length > longestValue.length) {
      longestValue = trimmed;
    }
  }
  return longestValue;
}

function getReviewItemDisplayText(
  item: TweetPatternReviewItem | null | undefined
): string {
  return (
    pickLongestText(
      item?.review_text,
      item?.enriched_text,
      item?.raw_text,
      item?.quoted_text
    ) ?? "No tweet text captured."
  );
}

function getReviewItemSourceName(
  item: TweetPatternReviewItem | null | undefined,
  authorOverride?: AuthorOverride | null
): string {
  const overrideName = authorOverride?.authorName?.trim();
  if (overrideName) return overrideName;

  const sourceUrlHandle =
    parseHandleFromTweetUrl(item?.source_url) ??
    parseHandleFromTweetUrl(item?.tweet_url);
  const displayHandle =
    normalizeSourceHandle(authorOverride?.authorHandle) ??
    sourceUrlHandle ??
    normalizeSourceHandle(item?.source_handle);
  const authorName = item?.author_name?.trim();
  const sourceLabel = item?.source_label?.trim();
  const sourceAccount = item?.source_account?.trim();
  const isFeedName =
    authorName &&
    [sourceLabel, sourceAccount].some(
      (value) => value && value.toLowerCase() === authorName.toLowerCase()
    );
  return (
    (!isFeedName ? authorName : null) ||
    displayHandle ||
    sourceLabel ||
    sourceAccount ||
    item?.source_key?.trim() ||
    item?.source_table ||
    "Unknown source"
  );
}

function getReviewItemSourceHandle(
  item: TweetPatternReviewItem | null | undefined,
  authorOverride?: AuthorOverride | null
): string | null {
  const handle =
    normalizeSourceHandle(authorOverride?.authorHandle) ??
    parseHandleFromTweetUrl(item?.source_url) ??
    parseHandleFromTweetUrl(item?.tweet_url) ??
    normalizeSourceHandle(item?.source_handle);
  if (!handle) return null;
  if (
    handle.toLowerCase() ===
    getReviewItemSourceName(item, authorOverride).toLowerCase()
  ) {
    return null;
  }
  return handle;
}

function getReviewItemSourceFeed(
  item: TweetPatternReviewItem | null | undefined,
  authorOverride?: AuthorOverride | null
): string | null {
  const blocked = new Set(
    [
      getReviewItemSourceName(item, authorOverride),
      getReviewItemSourceHandle(item, authorOverride)
    ]
      .map((value) => value?.trim().toLowerCase())
      .filter(Boolean)
  );

  for (const candidate of [
    item?.source_label,
    item?.source_key,
    item?.source_group,
    item?.source_account
  ]) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (!blocked.has(trimmed.toLowerCase())) return formatNewsFeedLabel(trimmed);
  }

  return null;
}

function getReviewItemTweetLookupUrl(
  item: TweetPatternReviewItem | null | undefined
): string | null {
  return item?.source_url ?? item?.tweet_url ?? null;
}

function buildNewsDraftFromItem(
  item: TweetPatternReviewItem | null | undefined,
  assignment?: TweetPatternReviewAssignment | null
): NewsDraft {
  if (!item) return createEmptyNewsDraft();

  const fallbackPlayers = Array.from(
    new Set(
      (item.review_assignments ?? [])
        .flatMap((reviewAssignment) => reviewAssignment.playerNames)
        .filter(Boolean)
    )
  );
  const fallbackPlayerIds = Array.from(
    new Set(
      (item.review_assignments ?? []).flatMap(
        (reviewAssignment) => reviewAssignment.playerIds
      )
    )
  );
  const primaryAssignment = assignment ?? item.review_assignments?.[0] ?? null;
  const playerNames = primaryAssignment?.playerNames?.length
    ? primaryAssignment.playerNames
    : fallbackPlayers;
  const playerIds = primaryAssignment?.playerIds?.length
    ? primaryAssignment.playerIds
    : fallbackPlayerIds;
  const category =
    primaryAssignment?.category ??
    normalizeNewsCategory(item.parser_classification) ??
    "";
  const subcategory = primaryAssignment?.subcategory ?? "";

  return {
    itemId: null,
    headline: buildNewsFeedHeadline({
      playerNames,
      category,
      subcategory,
      teamAbbreviation: item.team_abbreviation ?? null
    }),
    blurb: "",
    category,
    subcategory,
    teamId: item.team_id ? String(item.team_id) : "",
    teamAbbreviation: item.team_abbreviation ?? "",
    playerIds,
    playerNames,
    pendingPlayerId: "",
    pendingPlayerName: ""
  };
}

function toEditableAssignment(
  assignment: TweetPatternReviewAssignment
): EditableAssignment {
  return {
    ...assignment,
    pendingHighlight: "",
    pendingPlayerId: "",
    pendingPlayerName: ""
  };
}

async function fetchWithOptionalAuth(url: string): Promise<ApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

async function fetchReviewNewsWithOptionalAuth(
  url: string
): Promise<ReviewNewsApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

async function fetchAuthorLookupWithOptionalAuth(
  url: string
): Promise<AuthorLookupApiData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? "Author lookup failed.");
  }
  return payload;
}

async function postWithOptionalAuth(
  url: string,
  body: Record<string, unknown>
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
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
    new Set(highlights.map((value) => value.trim()).filter(Boolean))
  ).sort((left, right) => right.length - left.length);
  if (uniqueHighlights.length === 0) return text;

  const pattern = new RegExp(
    `(${uniqueHighlights.map(escapeRegExp).join("|")})`,
    "gi"
  );
  return text.split(pattern).map((part, index) =>
    uniqueHighlights.some(
      (highlight) => part.toLowerCase() === highlight.toLowerCase()
    ) ? (
      <mark
        key={index}
        className={styles.highlightMark}
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

const TweetPatternReviewPage: NextPage = () => {
  const [items, setItems] = useState<TweetPatternReviewItem[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<
    PatternCategoryOption[]
  >([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [assignments, setAssignments] = useState<EditableAssignment[]>([]);
  const [capturedSelection, setCapturedSelection] = useState("");
  const [savedNewsItems, setSavedNewsItems] = useState<NewsFeedItem[]>([]);
  const [savedKeywordPhrases, setSavedKeywordPhrases] = useState<
    NewsFeedKeywordPhrase[]
  >([]);
  const [authorOverrides, setAuthorOverrides] = useState<
    Record<string, AuthorOverride>
  >({});
  const [newsDraft, setNewsDraft] = useState<NewsDraft>(createEmptyNewsDraft());
  const [keywordDraft, setKeywordDraft] = useState<KeywordDraft>(
    createEmptyKeywordDraft()
  );
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">(
    "pending"
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
        limit: "150"
      });
      const payload = await fetchWithOptionalAuth(
        `/api/v1/db/tweet-pattern-review?${query.toString()}`
      );
      setItems(payload.items);
      setPlayers(payload.players);
      setCategoryOptions(payload.categoryOptions);
      setSelectedItemId((current) => {
        if (current && payload.items.some((item) => item.id === current))
          return current;
        return payload.items[0]?.id ?? "";
      });
      setIsLoading(false);
    },
    [statusFilter]
  );

  useEffect(() => {
    void loadData().catch((error) => {
      setStatusMessage(error.message);
      setIsLoading(false);
    });
  }, [loadData]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId]
  );
  const selectedAuthorOverride = selectedItem
    ? authorOverrides[selectedItem.id] ?? null
    : null;
  const teamOptions = useMemo(() => getTeamOptions(), []);
  const selectedItemDisplayText = useMemo(
    () => getReviewItemDisplayText(selectedItem),
    [selectedItem]
  );

  useEffect(() => {
    const nextAssignments = selectedItem?.review_assignments?.length
      ? selectedItem.review_assignments.map(toEditableAssignment)
      : [createEmptyAssignment()];
    setAssignments(nextAssignments);
    setCapturedSelection("");
  }, [selectedItem]);

  useEffect(() => {
    setNewsDraft(buildNewsDraftFromItem(selectedItem));
    setKeywordDraft({
      phrase: "",
      category:
        selectedItem?.review_assignments?.[0]?.category ??
        normalizeNewsCategory(selectedItem?.parser_classification) ??
        "",
      subcategory: selectedItem?.review_assignments?.[0]?.subcategory ?? "",
      notes: ""
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

  useEffect(() => {
    if (!selectedItem?.id || authorOverrides[selectedItem.id]) return;
    const lookupUrl = getReviewItemTweetLookupUrl(selectedItem);
    if (!lookupUrl) return;

    const query = new URLSearchParams({ authorLookupUrl: lookupUrl });
    void fetchAuthorLookupWithOptionalAuth(
      `/api/v1/db/tweet-pattern-review?${query.toString()}`
    )
      .then((payload) => {
        if (!payload.authorName && !payload.authorHandle) return;
        setAuthorOverrides((current) => ({
          ...current,
          [selectedItem.id]: {
            authorName: payload.authorName,
            authorHandle: payload.authorHandle
          }
        }));
      })
      .catch(() => {
        // Author lookup is a display enhancement; keep review flow quiet on rate limits.
      });
  }, [authorOverrides, selectedItem]);

  const currentIndex = selectedItem
    ? items.findIndex((item) => item.id === selectedItem.id)
    : -1;
  const pendingCount = useMemo(
    () => items.filter((item) => item.review_status === "pending").length,
    [items]
  );
  const filteredPlayers = useMemo(() => {
    if (!selectedItem?.team_id) return players;
    const teamPlayers = players.filter(
      (player) => player.team_id === selectedItem.team_id
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
    updater: (assignment: EditableAssignment) => EditableAssignment
  ) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? updater(assignment) : assignment
      )
    );
  }

  function addAssignment() {
    setAssignments((current) => [...current, createEmptyAssignment()]);
  }

  function removeAssignment(assignmentId: string) {
    setAssignments((current) =>
      current.length > 1
        ? current.filter((assignment) => assignment.id !== assignmentId)
        : current
    );
  }

  function addPlayerToAssignment(assignmentId: string) {
    updateAssignment(assignmentId, (assignment) => {
      const selectedPlayer = filteredPlayers.find(
        (player) => String(player.id) === assignment.pendingPlayerId
      );
      if (!selectedPlayer) return assignment;
      if (assignment.playerIds.includes(selectedPlayer.id)) {
        return { ...assignment, pendingPlayerId: "" };
      }
      return {
        ...assignment,
        playerIds: [...assignment.playerIds, selectedPlayer.id],
        playerNames: [...assignment.playerNames, selectedPlayer.fullName],
        pendingPlayerId: ""
      };
    });
  }

  function addManualPlayerNameToAssignment(assignmentId: string) {
    updateAssignment(assignmentId, (assignment) => {
      const name = assignment.pendingPlayerName.trim();
      if (!name) return assignment;
      if (
        assignment.playerNames.some(
          (playerName) => playerName.toLowerCase() === name.toLowerCase()
        )
      ) {
        return { ...assignment, pendingPlayerName: "" };
      }
      return {
        ...assignment,
        playerNames: [...assignment.playerNames, name],
        pendingPlayerName: ""
      };
    });
  }

  function removePlayerFromAssignment(
    assignmentId: string,
    playerName: string
  ) {
    updateAssignment(assignmentId, (assignment) => {
      const playerIndex = assignment.playerNames.findIndex(
        (value) => value === playerName
      );
      if (playerIndex < 0) return assignment;
      const nextPlayerNames = assignment.playerNames.filter(
        (value) => value !== playerName
      );
      const nextPlayerIds = [...assignment.playerIds];
      if (playerIndex < nextPlayerIds.length) {
        nextPlayerIds.splice(playerIndex, 1);
      }
      return {
        ...assignment,
        playerIds: nextPlayerIds,
        playerNames: nextPlayerNames
      };
    });
  }

  function addHighlightToAssignment(assignmentId: string, phrase: string) {
    const trimmedPhrase = phrase.trim();
    if (!trimmedPhrase) return;
    updateAssignment(assignmentId, (assignment) => {
      if (
        assignment.highlightPhrases.some(
          (value) => value.toLowerCase() === trimmedPhrase.toLowerCase()
        )
      ) {
        return { ...assignment, pendingHighlight: "" };
      }
      return {
        ...assignment,
        highlightPhrases: [...assignment.highlightPhrases, trimmedPhrase],
        pendingHighlight: ""
      };
    });
    setCapturedSelection("");
  }

  function applyAssignmentToNewsDraft(assignment: EditableAssignment) {
    setNewsDraft(buildNewsDraftFromItem(selectedItem, assignment));
  }

  function startNewNewsCard() {
    setNewsDraft(buildNewsDraftFromItem(selectedItem));
  }

  function addPlayerToNewsDraft() {
    const selectedPlayer = filteredDraftPlayers.find(
      (player) => String(player.id) === newsDraft.pendingPlayerId
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
      pendingPlayerId: ""
    }));
  }

  function addManualPlayerToNewsDraft() {
    const playerName = newsDraft.pendingPlayerName.trim();
    if (!playerName) return;
    if (
      newsDraft.playerNames.some(
        (existingName) =>
          existingName.toLowerCase() === playerName.toLowerCase()
      )
    ) {
      setNewsDraft((current) => ({ ...current, pendingPlayerName: "" }));
      return;
    }
    setNewsDraft((current) => ({
      ...current,
      playerNames: [...current.playerNames, playerName],
      pendingPlayerName: ""
    }));
  }

  function removePlayerFromNewsDraft(playerName: string) {
    setNewsDraft((current) => {
      const playerIndex = current.playerNames.findIndex(
        (value) => value === playerName
      );
      if (playerIndex < 0) return current;
      const nextPlayerNames = current.playerNames.filter(
        (value) => value !== playerName
      );
      const nextPlayerIds = [...current.playerIds];
      if (playerIndex < nextPlayerIds.length) {
        nextPlayerIds.splice(playerIndex, 1);
      }
      return {
        ...current,
        playerNames: nextPlayerNames,
        playerIds: nextPlayerIds
      };
    });
  }

  function removeHighlightFromAssignment(assignmentId: string, phrase: string) {
    updateAssignment(assignmentId, (assignment) => ({
      ...assignment,
      highlightPhrases: assignment.highlightPhrases.filter(
        (value) => value !== phrase
      )
    }));
  }

  async function syncQueue() {
    setIsSyncing(true);
    try {
      const payload = await postWithOptionalAuth(
        "/api/v1/db/tweet-pattern-review",
        {
          action: "sync",
          perSourceLimit: 200
        }
      );
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
        playerNames: assignment.playerNames
          .map((name) => name.trim())
          .filter(Boolean),
        highlightPhrases: assignment.highlightPhrases
          .map((phrase) => phrase.trim())
          .filter(Boolean),
        notes: assignment.notes?.trim() || null
      }))
      .filter((assignment) => assignment.category);

    if (cleanedAssignments.length === 0) {
      setStatusMessage("Add at least one assignment before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = await postWithOptionalAuth(
        "/api/v1/db/tweet-pattern-review",
        {
          itemId: selectedItem.id,
          reviewAssignments: cleanedAssignments
        }
      );
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
      const payload = await postWithOptionalAuth(
        "/api/v1/db/tweet-pattern-review",
        {
          action,
          itemId: selectedItem.id
        }
      );
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
    const teamOption = teamOptions.find(
      (team) => String(team.id) === newsDraft.teamId
    );
    const sourceName = getReviewItemSourceName(
      selectedItem,
      selectedAuthorOverride
    );
    const sourceHandle = getReviewItemSourceHandle(
      selectedItem,
      selectedAuthorOverride
    );
    const sourceFeed = getReviewItemSourceFeed(
      selectedItem,
      selectedAuthorOverride
    );

    setIsSavingNews(true);
    try {
      const payload = await postWithOptionalAuth("/api/v1/db/news-feed-items", {
        action: "saveCard",
        itemId: newsDraft.itemId,
        sourceReviewItemId: selectedItem.id,
        sourceTweetId: selectedItem.tweet_id,
        sourceUrl: selectedItem.source_url,
        tweetUrl: selectedItem.tweet_url,
        sourceLabel: sourceName,
        sourceAccount: sourceHandle,
        observedAt: selectedItem.source_created_at,
        teamId: teamOption?.id ?? selectedItem.team_id ?? null,
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
          teamId: teamOption?.id ?? selectedItem.team_id ?? null
        })),
        metadata: {
          parserClassification: selectedItem.parser_classification,
          parserFilterStatus: selectedItem.parser_filter_status,
          sourceFeed,
          sourceAccount: selectedItem.source_account,
          sourceKey: selectedItem.source_key
        }
      });
      setStatusMessage(payload.message ?? "News card saved.");
      const refreshed = await fetchReviewNewsWithOptionalAuth(
        `/api/v1/db/news-feed-items?reviewItemId=${encodeURIComponent(selectedItem.id)}&status=all&limit=20`
      );
      setSavedNewsItems(refreshed.items);
      setSavedKeywordPhrases(refreshed.keywordPhrases);
      setNewsDraft((current) => ({
        ...current,
        itemId: payload.itemId ?? current.itemId
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
        notes: keywordDraft.notes
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
      <div className={styles.page}>
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className={styles.pageHeader}>
          <h1>Tweet Pattern Review</h1>
          {statusMessage ? (
            <span className={styles.statusMessage}>{statusMessage}</span>
          ) : null}
        </header>

        {/* ── Workspace ───────────────────────────────────────────────────── */}
        <div className={styles.workspace}>
          {/* ── Control bar ───────────────────────────────────────────────── */}
          <div className={styles.controlBar}>
            <div className={styles.controlField}>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  const nextFilter = event.target.value as ReviewStatus | "all";
                  setStatusFilter(nextFilter);
                  void loadData(nextFilter).catch((error) =>
                    setStatusMessage(error.message)
                  );
                }}
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="ignored">Ignored</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className={`${styles.controlField} ${styles.queueField}`}>
              <span>Queue item</span>
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                disabled={items.length === 0}
              >
                {items.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {index + 1}.{" "}
                    {getReviewItemSourceName(item, authorOverrides[item.id])} ·{" "}
                    {item.team_abbreviation ?? "No team"} ·{" "}
                    {item.tweet_id ?? "No tweet id"}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.navGroup}>
              <button
                className={styles.btn}
                disabled={currentIndex <= 0}
                onClick={() => moveSelection(-1)}
              >
                ←
              </button>
              <button
                className={styles.btn}
                disabled={currentIndex < 0 || currentIndex >= items.length - 1}
                onClick={() => moveSelection(1)}
              >
                →
              </button>
            </div>

            <button
              className={styles.btn}
              disabled={isSyncing}
              onClick={() => void syncQueue()}
            >
              {isSyncing ? "Syncing…" : "Sync queue"}
            </button>

            <div className={styles.pendingBadge}>
              <span className={styles.pendingCount}>{pendingCount}</span> pending
            </div>
          </div>

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className={styles.leftColumn}>
            {isLoading ? (
              <div className={styles.stateMessage}>Loading…</div>
            ) : null}
            {!isLoading && !selectedItem ? (
              <div className={styles.stateMessage}>
                No items in queue for this filter.
              </div>
            ) : null}

            {selectedItem ? (
              <>
                {/* Tweet panel */}
                <div className={styles.tweetPanel}>
                  <div className={styles.tweetMeta}>
                    <span className={styles.metaItem}>
                      <strong>Source:</strong>{" "}
                      {getReviewItemSourceName(
                        selectedItem,
                        selectedAuthorOverride
                      )}
                    </span>
                    {getReviewItemSourceHandle(
                      selectedItem,
                      selectedAuthorOverride
                    ) ? (
                      <span className={styles.metaItem}>
                        <strong>Handle:</strong>{" "}
                        {getReviewItemSourceHandle(
                          selectedItem,
                          selectedAuthorOverride
                        )}
                      </span>
                    ) : null}
                    {getReviewItemSourceFeed(
                      selectedItem,
                      selectedAuthorOverride
                    ) ? (
                      <span className={styles.metaItem}>
                        <strong>Feed:</strong>{" "}
                        {getReviewItemSourceFeed(
                          selectedItem,
                          selectedAuthorOverride
                        )}
                      </span>
                    ) : null}
                    <span className={styles.metaItem}>
                      <strong>Team:</strong>{" "}
                      {selectedItem.team_abbreviation ?? "Unknown"}
                    </span>
                    <span className={styles.metaItem}>
                      <strong>Parser:</strong>{" "}
                      {formatNewsFeedLabel(selectedItem.parser_classification) ||
                        "None"}
                    </span>
                    <span className={styles.metaItem}>
                      <strong>Filter:</strong>{" "}
                      {formatNewsFeedLabel(selectedItem.parser_filter_status) ||
                        "None"}
                    </span>
                    <span className={styles.metaItem}>
                      {formatTimestamp(selectedItem.source_created_at)}
                    </span>
                  </div>

                  {selectedItem.source_url ||
                  selectedItem.tweet_url ||
                  selectedItem.quoted_tweet_url ? (
                    <div className={styles.tweetLinks}>
                      {selectedItem.source_url ? (
                        <a
                          href={selectedItem.source_url}
                          className={styles.tweetLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source tweet
                        </a>
                      ) : null}
                      {selectedItem.tweet_url &&
                      selectedItem.tweet_url !== selectedItem.source_url ? (
                        <a
                          href={selectedItem.tweet_url}
                          className={styles.tweetLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open tweet URL
                        </a>
                      ) : null}
                      {selectedItem.quoted_tweet_url ? (
                        <a
                          href={selectedItem.quoted_tweet_url}
                          className={styles.tweetLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open quoted tweet
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedItem.keyword_hits &&
                  selectedItem.keyword_hits.length > 0 ? (
                    <div className={styles.keywordChips}>
                      {selectedItem.keyword_hits.map((keyword) => (
                        <span key={keyword} className={styles.keywordChip}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <pre
                    className={styles.tweetText}
                    onMouseUp={(event) => {
                      const selection = window.getSelection();
                      if (
                        !selection ||
                        selection.isCollapsed ||
                        selection.rangeCount === 0
                      ) {
                        setCapturedSelection("");
                        return;
                      }
                      const range = selection.getRangeAt(0);
                      if (
                        !event.currentTarget.contains(
                          range.commonAncestorContainer
                        )
                      ) {
                        setCapturedSelection("");
                        return;
                      }
                      setCapturedSelection(selection.toString().trim());
                    }}
                  >
                    {renderHighlightedText(
                      selectedItemDisplayText,
                      assignments.flatMap((a) => a.highlightPhrases)
                    )}
                  </pre>
                </div>

                {/* Assignments pane */}
                <div className={styles.assignmentsPane}>
                  <div className={styles.paneHeader}>
                    <span>Assignments</span>
                    <button
                      className={styles.btn}
                      onClick={() => addAssignment()}
                    >
                      + Add assignment
                    </button>
                  </div>

                  <div className={styles.assignmentsBody}>
                    {assignments.map((assignment, index) => {
                      const selectedCategoryOption =
                        categoryOptions.find(
                          (option) =>
                            option.category.toLowerCase() ===
                            assignment.category.trim().toLowerCase()
                        ) ?? null;

                      return (
                        <div
                          key={assignment.id}
                          className={styles.assignmentCard}
                        >
                          <datalist id="tweet-pattern-categories">
                            {categoryOptions.map((option) => (
                              <option
                                key={option.category}
                                value={option.category}
                              />
                            ))}
                          </datalist>
                          <datalist
                            id={`tweet-pattern-subcategories-${assignment.id}`}
                          >
                            {(selectedCategoryOption?.subcategories ?? []).map(
                              (subcategory) => (
                                <option key={subcategory} value={subcategory} />
                              )
                            )}
                          </datalist>

                          <div className={styles.assignmentCardHeader}>
                            <span>Assignment {index + 1}</span>
                            <div className={styles.headerActions}>
                              <button
                                className={styles.btn}
                                onClick={() =>
                                  applyAssignmentToNewsDraft(assignment)
                                }
                              >
                                New card from assignment
                              </button>
                              <button
                                className={styles.btn}
                                disabled={assignments.length <= 1}
                                onClick={() => removeAssignment(assignment.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className={styles.assignmentGrid}>
                            <div className={styles.fieldRow}>
                              <div className={styles.formField}>
                                <label>Category</label>
                                <input
                                  list="tweet-pattern-categories"
                                  value={assignment.category}
                                  onChange={(event) =>
                                    updateAssignment(
                                      assignment.id,
                                      (current) => ({
                                        ...current,
                                        category: event.target.value
                                      })
                                    )
                                  }
                                  placeholder="INJURY, GOALIE START, LINE COMBINATION…"
                                />
                              </div>
                              <div className={styles.formField}>
                                <label>Subcategory</label>
                                <input
                                  list={`tweet-pattern-subcategories-${assignment.id}`}
                                  value={assignment.subcategory ?? ""}
                                  onChange={(event) =>
                                    updateAssignment(
                                      assignment.id,
                                      (current) => ({
                                        ...current,
                                        subcategory: event.target.value || null
                                      })
                                    )
                                  }
                                  placeholder="QUESTIONABLE, CONFIRMED STARTER…"
                                />
                              </div>
                            </div>

                            <div className={styles.fieldRowSplit}>
                              <div className={styles.formField}>
                                <label>Player from roster</label>
                                <select
                                  value={assignment.pendingPlayerId}
                                  onChange={(event) =>
                                    updateAssignment(
                                      assignment.id,
                                      (current) => ({
                                        ...current,
                                        pendingPlayerId: event.target.value
                                      })
                                    )
                                  }
                                >
                                  <option value="">Choose a player…</option>
                                  {filteredPlayers.map((player) => (
                                    <option key={player.id} value={player.id}>
                                      {player.fullName}
                                      {player.position
                                        ? ` — ${player.position}`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                className={styles.btn}
                                disabled={!assignment.pendingPlayerId}
                                onClick={() =>
                                  addPlayerToAssignment(assignment.id)
                                }
                              >
                                Add
                              </button>
                            </div>

                            <div className={styles.fieldRowSplit}>
                              <div className={styles.formField}>
                                <label>Manual player name</label>
                                <input
                                  value={assignment.pendingPlayerName}
                                  onChange={(event) =>
                                    updateAssignment(
                                      assignment.id,
                                      (current) => ({
                                        ...current,
                                        pendingPlayerName: event.target.value
                                      })
                                    )
                                  }
                                  placeholder="Player name or shorthand"
                                />
                              </div>
                              <button
                                className={styles.btn}
                                disabled={!assignment.pendingPlayerName.trim()}
                                onClick={() =>
                                  addManualPlayerNameToAssignment(assignment.id)
                                }
                              >
                                Add
                              </button>
                            </div>

                            {assignment.playerNames.length > 0 ? (
                              <div className={styles.chipsRow}>
                                {assignment.playerNames.map((playerName) => (
                                  <button
                                    key={`${assignment.id}-${playerName}`}
                                    className={styles.chipPlayer}
                                    onClick={() =>
                                      removePlayerFromAssignment(
                                        assignment.id,
                                        playerName
                                      )
                                    }
                                  >
                                    {playerName} ×
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className={styles.emptyNote}>
                                No players assigned.
                              </p>
                            )}

                            <div className={styles.evidenceRow}>
                              <button
                                className={styles.btn}
                                disabled={!capturedSelection}
                                onClick={() =>
                                  addHighlightToAssignment(
                                    assignment.id,
                                    capturedSelection
                                  )
                                }
                              >
                                Add selected text
                              </button>
                              <div className={styles.formField}>
                                <label>Manual evidence phrase</label>
                                <input
                                  value={assignment.pendingHighlight}
                                  onChange={(event) =>
                                    updateAssignment(
                                      assignment.id,
                                      (current) => ({
                                        ...current,
                                        pendingHighlight: event.target.value
                                      })
                                    )
                                  }
                                  placeholder="Expected starter, day to day, PP1…"
                                />
                              </div>
                              <button
                                className={styles.btn}
                                disabled={!assignment.pendingHighlight.trim()}
                                onClick={() =>
                                  addHighlightToAssignment(
                                    assignment.id,
                                    assignment.pendingHighlight
                                  )
                                }
                              >
                                Add phrase
                              </button>
                            </div>

                            {assignment.highlightPhrases.length > 0 ? (
                              <div className={styles.chipsRow}>
                                {assignment.highlightPhrases.map((phrase) => (
                                  <button
                                    key={`${assignment.id}-${phrase}`}
                                    className={styles.chipEvidence}
                                    onClick={() =>
                                      removeHighlightFromAssignment(
                                        assignment.id,
                                        phrase
                                      )
                                    }
                                  >
                                    {phrase} ×
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className={styles.emptyNote}>
                                No evidence text selected.
                              </p>
                            )}

                            <div
                              className={`${styles.formField} ${styles.notesField}`}
                            >
                              <label>Assignment notes</label>
                              <textarea
                                rows={2}
                                value={assignment.notes ?? ""}
                                onChange={(event) =>
                                  updateAssignment(
                                    assignment.id,
                                    (current) => ({
                                      ...current,
                                      notes: event.target.value || null
                                    })
                                  )
                                }
                                placeholder="Optional reasoning, regex idea, or ambiguity note."
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action bar */}
                <div className={styles.actionBar}>
                  <button
                    className={styles.btn}
                    disabled={currentIndex <= 0}
                    onClick={() => moveSelection(-1)}
                  >
                    ← Prev
                  </button>
                  <button
                    className={styles.btn}
                    disabled={
                      currentIndex < 0 || currentIndex >= items.length - 1
                    }
                    onClick={() => moveSelection(1)}
                  >
                    Next →
                  </button>
                  <button
                    className={styles.btnIgnore}
                    disabled={isSaving}
                    onClick={() => void updateReviewStatus("ignore")}
                  >
                    Ignore
                  </button>
                  <button
                    className={styles.btn}
                    disabled={isSaving}
                    onClick={() => void updateReviewStatus("requeue")}
                  >
                    Requeue
                  </button>
                  <div className={styles.actionBarSpacer} />
                  <button
                    className={styles.btnPrimary}
                    disabled={isSaving}
                    onClick={() => void saveReview()}
                  >
                    {isSaving ? "Saving…" : "Save assignments"}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div className={styles.rightColumn}>
            {/* Review guide */}

            {/* Right scrollable pane */}
            <div className={styles.rightPane}>
              {selectedItem ? (
                <>
                  {/* News card composer */}
                  <div className={styles.composerSection}>
                    <div className={styles.sectionHeader}>
                      <span>News card composer</span>
                      <div className={styles.headerActions}>
                        <button
                          className={styles.btn}
                          onClick={() => startNewNewsCard()}
                        >
                          Start new card
                        </button>
                        <a href="/news" target="_blank" rel="noreferrer">
                          Open /news
                        </a>
                      </div>
                    </div>

                    <div className={styles.composerGrid}>
                      <div className={styles.composerFormColumn}>
                        <div className={styles.fieldRow}>
                          <div className={styles.formField}>
                            <label>Headline</label>
                            <input
                              value={newsDraft.headline}
                              onChange={(event) =>
                                setNewsDraft((current) => ({
                                  ...current,
                                  headline: event.target.value
                                }))
                              }
                              placeholder="Write the card headline"
                            />
                          </div>
                          <div className={styles.formField}>
                            <label>Team</label>
                            <select
                              value={newsDraft.teamId}
                              onChange={(event) => {
                                const team = teamOptions.find(
                                  (option) =>
                                    String(option.id) === event.target.value
                                );
                                setNewsDraft((current) => ({
                                  ...current,
                                  teamId: event.target.value,
                                  teamAbbreviation: team?.abbreviation ?? ""
                                }));
                              }}
                            >
                              <option value="">Choose a team…</option>
                              {teamOptions.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles.fieldRow}>
                          <div className={styles.formField}>
                            <label>Category</label>
                            <input
                              list="tweet-pattern-categories"
                              value={newsDraft.category}
                              onChange={(event) =>
                                setNewsDraft((current) => ({
                                  ...current,
                                  category: event.target.value
                                }))
                              }
                              placeholder="INJURY, RETURN, GOALIE START…"
                            />
                          </div>
                          <div className={styles.formField}>
                            <label>Subcategory</label>
                            <input
                              value={newsDraft.subcategory}
                              onChange={(event) =>
                                setNewsDraft((current) => ({
                                  ...current,
                                  subcategory: event.target.value
                                }))
                              }
                              placeholder="QUESTIONABLE, PP1, TRADE…"
                            />
                          </div>
                        </div>

                        <div
                          className={`${styles.formField} ${styles.blurbField}`}
                        >
                          <label>Blurb</label>
                          <textarea
                            rows={3}
                            value={newsDraft.blurb}
                            onChange={(event) =>
                              setNewsDraft((current) => ({
                                ...current,
                                blurb: event.target.value
                              }))
                            }
                            placeholder="Write the distilled Rotowire-style blurb for this update."
                          />
                        </div>

                        <div className={styles.fieldRowSplit}>
                          <div className={styles.formField}>
                            <label>Add player from roster</label>
                            <select
                              value={newsDraft.pendingPlayerId}
                              onChange={(event) =>
                                setNewsDraft((current) => ({
                                  ...current,
                                  pendingPlayerId: event.target.value
                                }))
                              }
                            >
                              <option value="">Choose a player…</option>
                              {filteredDraftPlayers.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.fullName}
                                  {player.position
                                    ? ` — ${player.position}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            className={styles.btn}
                            disabled={!newsDraft.pendingPlayerId}
                            onClick={() => addPlayerToNewsDraft()}
                          >
                            Add
                          </button>
                        </div>

                        <div className={styles.fieldRowSplit}>
                          <div className={styles.formField}>
                            <label>Manual player text</label>
                            <input
                              value={newsDraft.pendingPlayerName}
                              onChange={(event) =>
                                setNewsDraft((current) => ({
                                  ...current,
                                  pendingPlayerName: event.target.value
                                }))
                              }
                              placeholder="Prospect, unsigned player, shorthand…"
                            />
                          </div>
                          <button
                            className={styles.btn}
                            disabled={!newsDraft.pendingPlayerName.trim()}
                            onClick={() => addManualPlayerToNewsDraft()}
                          >
                            Add
                          </button>
                        </div>

                        {newsDraft.playerNames.length > 0 ? (
                          <div className={styles.chipsRow}>
                            {newsDraft.playerNames.map((playerName) => (
                              <button
                                key={`news-draft-${playerName}`}
                                className={styles.chipPlayer}
                                onClick={() =>
                                  removePlayerFromNewsDraft(playerName)
                                }
                              >
                                {playerName} ×
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.emptyNote}>
                            No players attached to this card.
                          </p>
                        )}

                        <div className={styles.btnRow}>
                          <button
                            className={styles.btn}
                            disabled={isSavingNews}
                            onClick={() => void saveNewsCard("draft")}
                          >
                            {isSavingNews ? "Saving…" : "Save draft"}
                          </button>
                          <button
                            className={styles.btnPrimary}
                            disabled={isSavingNews}
                            onClick={() => void saveNewsCard("published")}
                          >
                            {isSavingNews ? "Saving…" : "Publish card"}
                          </button>
                        </div>
                      </div>

                      <div className={styles.composerPreviewColumn}>
                        <div className={styles.cardPreviewLabel}>
                          Card preview
                        </div>
                        <div className={styles.previewFrame}>
                          <NewsCard
                            compact
                            item={{
                              headline: newsDraft.headline || "Draft headline",
                              blurb:
                                newsDraft.blurb ||
                                "Write a concise fantasy-news blurb for this update.",
                              category:
                                normalizeNewsCategory(newsDraft.category) ||
                                "UPDATE",
                              subcategory:
                                normalizeNewsCategory(newsDraft.subcategory) ||
                                null,
                              team_abbreviation:
                                newsDraft.teamAbbreviation ||
                                selectedItem.team_abbreviation,
                              source_label:
                                getReviewItemSourceName(
                                  selectedItem,
                                  selectedAuthorOverride
                                ),
                              source_account:
                                getReviewItemSourceHandle(
                                  selectedItem,
                                  selectedAuthorOverride
                                ),
                              source_url: selectedItem.source_url,
                              published_at: null,
                              created_at: new Date().toISOString(),
                              card_status: "draft",
                              players: newsDraft.playerNames.map(
                                (playerName, index) => ({
                                  id: `${playerName}-${index}`,
                                  news_item_id: "draft",
                                  player_id: newsDraft.playerIds[index] ?? null,
                                  player_name: playerName,
                                  team_id:
                                    Number(newsDraft.teamId) ||
                                    selectedItem.team_id,
                                  role: "subject"
                                })
                              )
                            }}
                            sourceDisplayNameOverride={
                              selectedAuthorOverride?.authorName ?? null
                            }
                          />
                        </div>

                        {savedNewsItems.length > 0 ? (
                          <div className={styles.savedCards}>
                            <div className={styles.savedCardsLabel}>
                              Saved for this tweet
                            </div>
                            <div className={styles.savedCardsRail}>
                              {savedNewsItems.map((item) => (
                                <div
                                  key={item.id}
                                  className={styles.savedCardItem}
                                >
                                  <NewsCard
                                    compact
                                    item={item}
                                    sourceDisplayNameOverride={
                                      selectedAuthorOverride?.authorName ?? null
                                    }
                                  />
                                  <button
                                    className={styles.btn}
                                    onClick={() =>
                                      setNewsDraft({
                                        itemId: item.id,
                                        headline: item.headline,
                                        blurb: item.blurb,
                                        category: item.category,
                                        subcategory: item.subcategory ?? "",
                                        teamId: item.team_id
                                          ? String(item.team_id)
                                          : "",
                                        teamAbbreviation:
                                          item.team_abbreviation ?? "",
                                        playerIds: item.players
                                          .map((p) => p.player_id ?? 0)
                                          .filter(Boolean),
                                        playerNames: item.players.map(
                                          (p) => p.player_name
                                        ),
                                        pendingPlayerId: "",
                                        pendingPlayerName: ""
                                      })
                                    }
                                  >
                                    Load into composer
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Keyword phrases */}
                  <div className={styles.keywordsSection}>
                    <div className={styles.sectionHeader}>
                      <span>Novel keyword phrases</span>
                    </div>

                    <div className={styles.keywordGrid}>
                      <div className={styles.fieldRow}>
                        <div className={styles.formField}>
                          <label>Phrase</label>
                          <input
                            value={keywordDraft.phrase}
                            onChange={(event) =>
                              setKeywordDraft((current) => ({
                                ...current,
                                phrase: event.target.value
                              }))
                            }
                            placeholder="Projected starter, no contact jersey, PP1…"
                          />
                        </div>
                        <div className={styles.formField}>
                          <label>Category</label>
                          <input
                            value={keywordDraft.category}
                            onChange={(event) =>
                              setKeywordDraft((current) => ({
                                ...current,
                                category: event.target.value
                              }))
                            }
                            placeholder="GOALIE START, INJURY…"
                          />
                        </div>
                        <div className={styles.formField}>
                          <label>Subcategory</label>
                          <input
                            value={keywordDraft.subcategory}
                            onChange={(event) =>
                              setKeywordDraft((current) => ({
                                ...current,
                                subcategory: event.target.value
                              }))
                            }
                            placeholder="QUESTIONABLE, EXPECTED STARTER…"
                          />
                        </div>
                      </div>

                      <div
                        className={`${styles.formField} ${styles.keywordNotesField}`}
                      >
                        <label>Notes</label>
                        <textarea
                          rows={2}
                          value={keywordDraft.notes}
                          onChange={(event) =>
                            setKeywordDraft((current) => ({
                              ...current,
                              notes: event.target.value
                            }))
                          }
                          placeholder="When this phrase should or should not trigger."
                        />
                      </div>

                      <button
                        className={styles.btn}
                        disabled={isSavingKeyword}
                        onClick={() => void saveKeywordPhrase()}
                      >
                        {isSavingKeyword ? "Saving…" : "Save keyword phrase"}
                      </button>
                    </div>

                    {savedKeywordPhrases.length > 0 ? (
                      <div className={styles.chipsRow}>
                        {savedKeywordPhrases.map((phrase) => (
                          <span key={phrase.id} className={styles.keywordChip}>
                            {phrase.phrase}
                            {phrase.category
                              ? ` · ${formatNewsFeedLabel(phrase.category)}`
                              : ""}
                            {phrase.subcategory
                              ? ` · ${formatNewsFeedLabel(phrase.subcategory)}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyNote}>
                        No keyword phrases saved for this tweet.
                      </p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TweetPatternReviewPage;
