import { useMemo, useState, type FormEvent } from "react";

import { useDraftPlayerSearch } from "hooks/useDraftPlayerSearch";
import { useDraftPlayerActions } from "hooks/useDraftPlayerActions";
import type { DraftPlayerSearchResult } from "hooks/useDraftPlayerSearch";

import type { PlacementCandidate } from "./AssistedPlacementPanel";
import styles from "./DraftRanker.module.scss";

type Props = {
  rankingId: string;
  rankedPlayerIds: number[];
  onPlacePlayer: (player: PlacementCandidate) => void;
};

function lifecycleLabel(status: string): string {
  return (
    {
      active_nhl: "Active NHL",
      active_prospect: "Prospect",
      unsigned_relevant: "Unsigned",
      inactive: "Inactive",
      retired: "Retired",
      overseas: "Overseas",
      deceased: "Archived",
    }[status] ?? status.replaceAll("_", " ")
  );
}

export default function DraftPlayerSearch({
  rankingId,
  rankedPlayerIds,
  onPlacePlayer,
}: Props) {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [organization, setOrganization] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const ranked = useMemo(() => new Set(rankedPlayerIds), [rankedPlayerIds]);
  const playerSearch = useDraftPlayerSearch(query, includeArchived, true);
  const playerActions = useDraftPlayerActions(rankingId);
  const results = playerSearch.search.data?.results ?? [];
  const watched = useMemo(
    () =>
      new Set(
        playerActions.state.data?.watchlist.map((item) => item.playerId) ?? [],
      ),
    [playerActions.state.data?.watchlist],
  );
  const watchlistCounts = useMemo(() => {
    const items = playerActions.state.data?.watchlist ?? [];
    const placed = items.filter((item) => ranked.has(item.playerId)).length;
    return { placed, unplaced: items.length - placed };
  }, [playerActions.state.data?.watchlist, ranked]);
  const preferences = useMemo(
    () =>
      new Map(
        playerActions.state.data?.preferences.map((item) => [
          item.playerId,
          item,
        ]) ?? [],
      ),
    [playerActions.state.data?.preferences],
  );
  const shouldShowResults = playerSearch.debouncedQuery.length >= 2;

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    playerSearch.requestAddition.mutate({
      rawName: query.trim(),
      organization: organization.trim() || undefined,
      position: position.trim() || undefined,
      notes: notes.trim() || undefined,
      candidatePlayerIds: results.slice(0, 10).map((player) => player.playerId),
    });
  }

  function applyAction(
    playerId: number,
    action: "watch" | "unwatch" | "dismiss" | "not_relevant" | "restore",
  ) {
    playerActions.action.mutate({
      playerId,
      action,
      operationId: crypto.randomUUID(),
    });
  }

  function placeSearchResult(player: DraftPlayerSearchResult) {
    playerActions.action.mutate({
      playerId: player.playerId,
      action: "compare_now",
      operationId: crypto.randomUUID(),
    });
    onPlacePlayer({
      playerId: player.playerId,
      canonicalName: player.canonicalName,
      position: player.position,
      organizationName: player.organizationName,
      headshotUrl: player.headshotUrl,
    });
  }

  return (
    <section
      className={styles.searchCard}
      aria-labelledby="player-search-title"
    >
      <div className={styles.searchHeading}>
        <div>
          <p className={styles.eyebrow}>Full player universe</p>
          <h2 id="player-search-title">Find a player</h2>
          <p>
            Search verified NHL players, prospects, and fantasy-relevant
            unsigned players. Similar names are always disambiguated.
          </p>
        </div>
        <label className={styles.archiveToggle}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Include archived players
        </label>
      </div>

      {playerActions.state.data?.watchlist.length ? (
        <div className={styles.watchlistPanel}>
          <div>
            <h3>Watchlist</h3>
            <span>
              {watchlistCounts.unplaced} unplaced · {watchlistCounts.placed}{" "}
              placed
            </span>
          </div>
          <ul>
            {playerActions.state.data.watchlist.map((item) => (
              <li key={item.playerId}>
                <span>
                  <strong>
                    {item.player?.canonical_name ?? `Player ${item.playerId}`}
                  </strong>
                  <small>
                    {[
                      item.player?.canonical_position,
                      item.player?.current_organization_name ?? "Unsigned",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={playerActions.action.isPending}
                  onClick={() => applyAction(item.playerId, "unwatch")}
                >
                  Remove
                </button>
                <button
                  type="button"
                  disabled={playerActions.action.isPending}
                  onClick={() => {
                    playerActions.action.mutate({
                      playerId: item.playerId,
                      action: "compare_now",
                      operationId: crypto.randomUUID(),
                    });
                    onPlacePlayer({
                      playerId: item.playerId,
                      canonicalName:
                        item.player?.canonical_name ??
                        `Player ${item.playerId}`,
                      position: item.player?.canonical_position ?? null,
                      organizationName:
                        item.player?.current_organization_name ?? null,
                      headshotUrl: item.player?.headshot_url ?? null,
                    });
                  }}
                >
                  {ranked.has(item.playerId) ? "Re-evaluate" : "Place"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className={styles.searchLabel} htmlFor="draft-player-search">
        Player name or NHL/Yahoo ID
      </label>
      <input
        id="draft-player-search"
        className={styles.searchInput}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setShowRequest(false);
          playerSearch.requestAddition.reset();
        }}
        placeholder="Search Connor McDavid, a prospect, or an ID"
        autoComplete="off"
        aria-controls="draft-player-search-results"
      />

      {shouldShowResults ? (
        <div className={styles.searchResultsWrap} aria-live="polite">
          {playerSearch.search.isLoading ? (
            <p className={styles.searchStatus}>Searching verified players…</p>
          ) : playerSearch.search.error ? (
            <p className={styles.error} role="alert">
              {playerSearch.search.error instanceof Error
                ? playerSearch.search.error.message
                : "Player search failed."}
            </p>
          ) : results.length ? (
            <ul
              id="draft-player-search-results"
              className={styles.searchResults}
            >
              {results.map((player) => {
                const onBoard = ranked.has(player.playerId);
                const isWatched = watched.has(player.playerId);
                const preference = preferences.get(player.playerId);
                return (
                  <li key={player.playerId}>
                    {player.headshotUrl ? (
                      <img src={player.headshotUrl} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.searchHeadshotFallback}>
                        {player.position ?? "?"}
                      </span>
                    )}
                    <div className={styles.searchIdentity}>
                      <strong>{player.canonicalName}</strong>
                      <span>
                        {[
                          player.birthYear,
                          player.position,
                          player.organizationName ?? "Unsigned",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <small>
                        {lifecycleLabel(player.lifecycleStatus)}
                        {player.yahooPlayerId
                          ? ` · Yahoo ${player.yahooPlayerId}`
                          : " · No Yahoo ID"}
                      </small>
                    </div>
                    <div className={styles.searchResultActions}>
                      <span
                        className={
                          onBoard
                            ? styles.onBoardBadge
                            : player.isRankable
                              ? styles.rankableBadge
                              : styles.archivedBadge
                        }
                      >
                        {onBoard
                          ? "On your board"
                          : player.isRankable
                            ? "Rankable"
                            : "Archived"}
                      </span>
                      {player.isRankable ? (
                        preference?.disposition ? (
                          <button
                            type="button"
                            disabled={playerActions.action.isPending}
                            onClick={() =>
                              applyAction(player.playerId, "restore")
                            }
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={playerActions.action.isPending}
                              onClick={() => placeSearchResult(player)}
                            >
                              {onBoard ? "Re-evaluate" : "Place"}
                            </button>
                            <button
                              type="button"
                              disabled={playerActions.action.isPending}
                              onClick={() =>
                                applyAction(
                                  player.playerId,
                                  isWatched ? "unwatch" : "watch",
                                )
                              }
                            >
                              {isWatched ? "Watching" : "Watch"}
                            </button>
                            <button
                              type="button"
                              disabled={playerActions.action.isPending}
                              onClick={() =>
                                applyAction(player.playerId, "dismiss")
                              }
                            >
                              Dismiss
                            </button>
                            <button
                              type="button"
                              disabled={playerActions.action.isPending}
                              onClick={() =>
                                applyAction(player.playerId, "not_relevant")
                              }
                            >
                              Not relevant
                            </button>
                          </>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.searchStatus}>
              No verified players match “{playerSearch.debouncedQuery}”.
            </p>
          )}

          <button
            className={styles.requestToggle}
            type="button"
            disabled={query.trim().length < 2}
            onClick={() => {
              setShowRequest((value) => !value);
              playerSearch.requestAddition.reset();
            }}
          >
            {showRequest
              ? "Cancel request"
              : "Can’t find the player? Request a review"}
          </button>
          {playerActions.action.error ? (
            <p className={styles.error} role="alert">
              {playerActions.action.error instanceof Error
                ? playerActions.action.error.message
                : "The player action could not be saved."}
            </p>
          ) : null}
        </div>
      ) : (
        <p className={styles.searchHint}>Enter at least two characters.</p>
      )}

      {showRequest ? (
        <form className={styles.additionForm} onSubmit={submitRequest}>
          <div>
            <h3>Request “{query.trim()}”</h3>
            <p>
              This creates an editorial review request. It never creates an
              unverified player identity.
            </p>
          </div>
          <label>
            Current team or organization
            <input
              value={organization}
              maxLength={120}
              onChange={(event) => setOrganization(event.target.value)}
            />
          </label>
          <label>
            Position
            <input
              value={position}
              maxLength={20}
              onChange={(event) => setPosition(event.target.value)}
            />
          </label>
          <label className={styles.requestNotes}>
            Why should this player be available?
            <textarea
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={playerSearch.requestAddition.isPending}
          >
            {playerSearch.requestAddition.isPending
              ? "Submitting…"
              : "Submit for editorial review"}
          </button>
          {playerSearch.requestAddition.error ? (
            <p className={styles.error} role="alert">
              {playerSearch.requestAddition.error instanceof Error
                ? playerSearch.requestAddition.error.message
                : "The request could not be submitted."}
            </p>
          ) : playerSearch.requestAddition.data ? (
            <p className={styles.requestSuccess} role="status">
              {playerSearch.requestAddition.data.created
                ? "Request submitted. FHFH editorial review is now pending."
                : "This player is already awaiting FHFH editorial review."}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
