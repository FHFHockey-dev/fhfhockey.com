import { useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";

import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";
import { SPLITS_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import { teamsInfo } from "lib/teamsInfo";
import type { SplitsApiResponse } from "lib/splits/splitsSurface";

import styles from "./splits.module.scss";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload != null &&
      typeof payload === "object" &&
      typeof payload.error === "string"
        ? payload.error
        : "Unable to load splits.";
    throw new Error(message);
  }

  return payload as SplitsApiResponse;
};

function normalizeQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }

  return null;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatRate(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return value.toFixed(2);
}

function formatToiPerGame(value: number | null | undefined) {
  if (value == null || value < 0) {
    return "—";
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SplitsPage() {
  const router = useRouter();
  const team = normalizeQueryValue(router.query.team);
  const opponent = normalizeQueryValue(router.query.opponent);
  const playerId = normalizeQueryValue(router.query.playerId);

  const teamOptions = useMemo(
    () =>
      Object.entries(teamsInfo)
        .map(([abbreviation, info]) => ({
          abbreviation,
          name: info.name,
        }))
        .sort((left, right) =>
          left.abbreviation.localeCompare(right.abbreviation)
        ),
    []
  );

  const requestPath = useMemo(() => {
    if (!team) {
      return null;
    }

    const query = new URLSearchParams({ team });
    if (opponent) {
      query.set("opponent", opponent);
    }
    if (playerId) {
      query.set("playerId", playerId);
    }

    return `/api/v1/splits?${query.toString()}`;
  }, [opponent, playerId, team]);

  const { data, error, isLoading } = useSWR<SplitsApiResponse>(
    requestPath,
    fetcher
  );

  const updateQuery = (partial: Record<string, string | null>) => {
    const nextQuery = {
      ...router.query,
      ...partial,
    } as Record<string, string | string[] | undefined | null>;

    Object.keys(nextQuery).forEach((key) => {
      const value = nextQuery[key];
      if (value == null || value === "") {
        delete nextQuery[key];
      }
    });

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <>
      <Head>
        <title>Splits | FHFHockey</title>
        <meta
          name="description"
          content="Player versus team, team versus team, and PP shot-share context for fantasy decisions."
        />
      </Head>

      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Fantasy Decision Surface</p>
            <h1 className={styles.title}>Splits & Matchup Context</h1>
            <p className={styles.description}>
              Compare team recent form, isolate a player against an opponent,
              and keep PP shot role visible next to the current deployment story.
            </p>
          </div>
        </header>

        <SurfaceWorkflowLinks
          title="Keep The Context Moving"
          description="Carry this split view back into deployment, slate planning, or league-wide recent form."
          links={SPLITS_SURFACE_LINKS}
        />

        <section className={styles.controls}>
          <label className={styles.control}>
            <span className={styles.controlLabel}>Team</span>
            <select
              className={styles.select}
              value={team ?? ""}
              onChange={(event) =>
                updateQuery({
                  team: event.target.value || null,
                  playerId: null,
                })
              }
            >
              <option value="">Select team</option>
              {teamOptions.map((option) => (
                <option key={option.abbreviation} value={option.abbreviation}>
                  {option.abbreviation} · {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.control}>
            <span className={styles.controlLabel}>Opponent</span>
            <select
              className={styles.select}
              value={opponent ?? ""}
              onChange={(event) =>
                updateQuery({
                  opponent: event.target.value || null,
                })
              }
              disabled={!team}
            >
              <option value="">Select opponent</option>
              {teamOptions
                .filter((option) => option.abbreviation !== team)
                .map((option) => (
                  <option key={option.abbreviation} value={option.abbreviation}>
                    {option.abbreviation} · {option.name}
                  </option>
                ))}
            </select>
          </label>

          <label className={styles.control}>
            <span className={styles.controlLabel}>Player</span>
            <select
              className={styles.select}
              value={playerId ?? ""}
              onChange={(event) =>
                updateQuery({
                  playerId: event.target.value || null,
                })
              }
              disabled={!data || data.playerOptions.length === 0}
            >
              <option value="">Select player</option>
              {(data?.playerOptions ?? []).map((option) => (
                <option key={option.playerId} value={String(option.playerId)}>
                  {option.playerName}
                  {option.positionCode ? ` · ${option.positionCode}` : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        {!team ? (
          <div className={styles.status}>Choose a team to load the splits surface.</div>
        ) : isLoading ? (
          <div className={styles.status}>Loading splits context...</div>
        ) : error ? (
          <div className={styles.error}>{error.message}</div>
        ) : data ? (
          <div className={styles.layout}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Team Leaders</h2>
                <p>
                  Fantasy pulse blends shots, points, ixG, and PP shot-share
                  role for a quick ranking surface.
                </p>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pulse</th>
                      <th>Shots/60</th>
                      <th>Pts/60</th>
                      <th>ixG/60</th>
                      <th>PP Shot Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamLeaders.map((row) => (
                      <tr key={row.playerId}>
                        <td>
                          {row.playerName}
                          {row.positionCode ? (
                            <span className={styles.inlineMeta}>
                              {row.positionCode}
                            </span>
                          ) : null}
                        </td>
                        <td>{formatRate(row.fantasyPulse)}</td>
                        <td>{formatRate(row.shotsPer60)}</td>
                        <td>{formatRate(row.totalPointsPer60)}</td>
                        <td>{formatRate(row.ixgPer60)}</td>
                        <td>{formatPercent(row.ppShotSharePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Power-Play Shot Share</h2>
                <p>
                  Dedicated PP shot role stays separate from unit membership and
                  PP TOI share.
                </p>
              </div>
              <div className={styles.chips}>
                {data.ppShotShare.map((row) => (
                  <div key={row.playerId} className={styles.chip}>
                    <strong>{row.playerName}</strong>
                    <span>{formatPercent(row.ppShotSharePct)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Team vs Team</h2>
                <p>
                  L10 offense, defense, and special-teams context in one place.
                </p>
              </div>
              {!opponent ? (
                <div className={styles.status}>
                  Pick an opponent to add the L10 matchup framing.
                </div>
              ) : (
                <div className={styles.cards}>
                  {data.matchupCards.map((card) => (
                    <article
                      key={card.key}
                      className={`${styles.card} ${styles[`edge${card.edge[0].toUpperCase()}${card.edge.slice(1)}`]}`}
                    >
                      <p className={styles.cardLabel}>{card.label}</p>
                      <h3 className={styles.cardValueRow}>
                        <span>{formatRate(card.teamValue)}</span>
                        <span className={styles.cardDivider}>vs</span>
                        <span>{formatRate(card.opponentValue)}</span>
                      </h3>
                      <p className={styles.cardMeta}>
                        {card.teamCaption} vs {card.opponentCaption}
                      </p>
                      <p className={styles.cardDescription}>{card.description}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Player vs Team</h2>
                <p>
                  Selected player baseline versus the same-season split against
                  this opponent.
                </p>
              </div>
              {!opponent ? (
                <div className={styles.status}>
                  Pick an opponent before using the player-versus-team view.
                </div>
              ) : !data.playerVsTeam ? (
                <div className={styles.status}>
                  Select a player to compare his season line against this
                  opponent split.
                </div>
              ) : (
                <div className={styles.compareGrid}>
                  <div className={styles.compareCard}>
                    <p className={styles.compareLabel}>Season Baseline</p>
                    <h3>{data.playerVsTeam.playerName}</h3>
                    <dl className={styles.compareList}>
                      <div>
                        <dt>GP</dt>
                        <dd>{data.playerVsTeam.season?.gamesPlayed ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>TOI/GP</dt>
                        <dd>
                          {formatToiPerGame(
                            data.playerVsTeam.season?.toiPerGameSeconds
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Shots/60</dt>
                        <dd>{formatRate(data.playerVsTeam.season?.shotsPer60)}</dd>
                      </div>
                      <div>
                        <dt>Pts/60</dt>
                        <dd>
                          {formatRate(data.playerVsTeam.season?.totalPointsPer60)}
                        </dd>
                      </div>
                      <div>
                        <dt>ixG/60</dt>
                        <dd>{formatRate(data.playerVsTeam.season?.ixgPer60)}</dd>
                      </div>
                      <div>
                        <dt>PP Shot Share</dt>
                        <dd>
                          {formatPercent(
                            data.playerVsTeam.season?.ppShotSharePct
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.compareCard}>
                    <p className={styles.compareLabel}>
                      Versus {data.playerVsTeam.opponentLabel}
                    </p>
                    <h3>{data.playerVsTeam.playerName}</h3>
                    <dl className={styles.compareList}>
                      <div>
                        <dt>GP</dt>
                        <dd>
                          {data.playerVsTeam.versusOpponent?.gamesPlayed ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>TOI/GP</dt>
                        <dd>
                          {formatToiPerGame(
                            data.playerVsTeam.versusOpponent?.toiPerGameSeconds
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Shots/60</dt>
                        <dd>
                          {formatRate(
                            data.playerVsTeam.versusOpponent?.shotsPer60
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Pts/60</dt>
                        <dd>
                          {formatRate(
                            data.playerVsTeam.versusOpponent?.totalPointsPer60
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>ixG/60</dt>
                        <dd>
                          {formatRate(data.playerVsTeam.versusOpponent?.ixgPer60)}
                        </dd>
                      </div>
                      <div>
                        <dt>PP Shot Share</dt>
                        <dd>
                          {formatPercent(
                            data.playerVsTeam.versusOpponent?.ppShotSharePct
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
