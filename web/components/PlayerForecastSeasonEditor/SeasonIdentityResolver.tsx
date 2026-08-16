import { useEffect, useMemo, useState } from "react";

import type {
  SeasonIdentityCandidate,
  SeasonIdentityLifecycleStatus,
} from "lib/fantasy-projections/identityResolution";
import styles from "styles/PlayerForecastSeasonEditor.module.scss";

type PlayerPoolReview = {
  id: string;
  raw_player_name: string;
  nhl_player_id: number | null;
  team_id: number | null;
  position: string | null;
};

type ResolutionBody = {
  reviewId: string;
  action: "map_existing" | "create_new" | "exclude";
  reason: string;
  fhfhPlayerId?: number;
  lifecycleStatus?: SeasonIdentityLifecycleStatus;
};

type Props = {
  review: PlayerPoolReview;
  disabled: boolean;
  request: (url: string, options?: RequestInit) => Promise<any>;
  onResolve: (body: ResolutionBody) => Promise<boolean>;
};

function matchLabel(candidate: SeasonIdentityCandidate): string {
  const labels: Record<string, string> = {
    external_id_exact: "Exact external ID",
    canonical_exact: "Exact name",
    alias_exact: "Exact alias",
    canonical_prefix: "Name prefix",
    alias_prefix: "Alias prefix",
    fuzzy: "Fuzzy name",
  };
  return labels[candidate.matchKind] ?? candidate.matchKind.replaceAll("_", " ");
}

function lifecycleLabel(status: SeasonIdentityLifecycleStatus): string {
  return {
    active_nhl: "Active NHL player",
    active_prospect: "Active prospect",
    unsigned_relevant: "Unsigned fantasy-relevant player",
  }[status];
}

export default function SeasonIdentityResolver({
  review,
  disabled,
  request,
  onResolve,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(review.raw_player_name);
  const [candidates, setCandidates] = useState<SeasonIdentityCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [lifecycleStatus, setLifecycleStatus] =
    useState<SeasonIdentityLifecycleStatus>("active_nhl");
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const listboxId = `identity-candidates-${review.id}`;
  const selected = useMemo(
    () => candidates.find((candidate) => candidate.fhfhPlayerId === selectedId) ?? null,
    [candidates, selectedId],
  );

  useEffect(() => {
    if (!expanded || query.trim().length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setLocalError(null);
      try {
        const payload = await request(
          `/api/v1/player-forecasts/admin/season-player-pool?reviewId=${encodeURIComponent(review.id)}&query=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        setCandidates(payload.candidates ?? []);
        setSelectedId((current) =>
          (payload.candidates ?? []).some(
            (candidate: SeasonIdentityCandidate) => candidate.fhfhPlayerId === current,
          )
            ? current
            : null,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLocalError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [expanded, query, request, review.id]);

  async function resolve(body: Omit<ResolutionBody, "reviewId" | "reason">) {
    if (!reason.trim()) {
      setLocalError("Enter an audit reason before resolving this identity.");
      return;
    }
    setResolving(true);
    setLocalError(null);
    const saved = await onResolve({
      ...body,
      reviewId: review.id,
      reason: reason.trim(),
    });
    setResolving(false);
    if (saved) setExpanded(false);
  }

  const controlsDisabled = disabled || resolving;
  return (
    <div className={styles.identityResolver}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`identity-resolver-${review.id}`}
        disabled={disabled}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Close resolver" : "Resolve identity"}
      </button>

      {expanded ? (
        <div id={`identity-resolver-${review.id}`} className={styles.identityResolverPanel}>
          <div>
            <strong>Find an existing FHFH identity</strong>
            <p>
              Search uses canonical names, verified aliases, NHL/Yahoo IDs, and
              fuzzy matching. The NHL API ID shown above is never treated as an
              internal FHFH ID.
            </p>
          </div>
          <label className={styles.identitySearch}>
            Potential player match
            <input
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={candidates.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={selected ? `identity-option-${selected.fhfhPlayerId}` : undefined}
              value={query}
              maxLength={80}
              disabled={controlsDisabled}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className={styles.identitySearchStatus} aria-live="polite">
            {searching
              ? "Searching verified identities…"
              : query.trim().length < 2
                ? "Enter at least two characters."
                : `${candidates.length} potential ${candidates.length === 1 ? "match" : "matches"}.`}
          </div>
          {candidates.length > 0 ? (
            <ul id={listboxId} className={styles.identityCandidates} role="listbox">
              {candidates.map((candidate) => {
                const isSelected = candidate.fhfhPlayerId === selectedId;
                return (
                  <li
                    key={candidate.fhfhPlayerId}
                  >
                    <button
                      id={`identity-option-${candidate.fhfhPlayerId}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={isSelected ? styles.identityCandidateSelected : undefined}
                      disabled={controlsDisabled}
                      onClick={() => setSelectedId(candidate.fhfhPlayerId)}
                    >
                      <span>
                        <strong>{candidate.canonicalName}</strong>
                        <small>
                          FHFH #{candidate.fhfhPlayerId} · {candidate.position ?? "?"} ·{" "}
                          {candidate.organizationName ?? "No organization"}
                        </small>
                      </span>
                      <span>
                        <small>{matchLabel(candidate)} · {Math.round(candidate.similarityScore * 100)}%</small>
                        <small>
                          {candidate.nhlPlayerId == null
                            ? "No NHL ID attached"
                            : `NHL ${candidate.nhlPlayerId}`}
                        </small>
                      </span>
                    </button>
                    {!candidate.mappingAllowed ? (
                      <p className={styles.identityConflict}>
                        This identity already has a different NHL ID. Direct mapping is blocked.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <label>
            Resolution reason
            <input
              value={reason}
              maxLength={500}
              disabled={controlsDisabled}
              placeholder="What evidence supports this decision?"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <div className={styles.identityResolutionActions}>
            <button
              type="button"
              disabled={controlsDisabled || !reason.trim() || !selected?.mappingAllowed}
              onClick={() => {
                if (selected) {
                  void resolve({
                    action: "map_existing",
                    fhfhPlayerId: selected.fhfhPlayerId,
                  });
                }
              }}
            >
              Map selected FHFH identity
            </button>
            <span>
              Mapping attaches NHL {review.nhl_player_id ?? "—"} to the selected
              FHFH identity in the same audited transaction.
            </span>
          </div>

          <div className={styles.identityCreatePanel}>
            <div>
              <strong>No safe match?</strong>
              <p>
                Revalidate NHL {review.nhl_player_id ?? "—"} against the official
                NHL player endpoint, create a verified FHFH identity, and map it.
              </p>
            </div>
            <label>
              Player lifecycle
              <select
                value={lifecycleStatus}
                disabled={controlsDisabled}
                onChange={(event) =>
                  setLifecycleStatus(event.target.value as SeasonIdentityLifecycleStatus)
                }
              >
                {(["active_nhl", "active_prospect", "unsigned_relevant"] as const).map(
                  (status) => (
                    <option key={status} value={status}>{lifecycleLabel(status)}</option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              disabled={controlsDisabled || !reason.trim() || review.nhl_player_id == null}
              onClick={() => void resolve({ action: "create_new", lifecycleStatus })}
            >
              Create verified identity &amp; map
            </button>
          </div>

          <div className={styles.identityExcludePanel}>
            <span>Exclude only when the official roster evidence is wrong or intentionally out of scope.</span>
            <button
              type="button"
              disabled={controlsDisabled || !reason.trim()}
              onClick={() => void resolve({ action: "exclude" })}
            >
              Exclude with reason
            </button>
          </div>
          {localError ? <p className={styles.identityConflict} role="alert">{localError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
