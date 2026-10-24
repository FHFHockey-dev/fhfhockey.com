import { useEffect, useMemo, useRef, useState } from "react";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { useMockDraft } from "hooks/useMockDraft";
import { useAuth } from "contexts/AuthProviderContext";
import { useDraftProAccess } from "hooks/useDraftProAccess";
import {
  ENGINE_VERSION,
  freePersonalities,
  leagueOf,
  personalities,
  type MockConfig,
  type MockLeague,
  type Personality,
} from "lib/mockDraft/contracts";
import { available, makeRoom, newSession, seatAt } from "lib/mockDraft/engine";
import { dashboardView, freezePlayers } from "lib/mockDraft/adapter";
import { researchAvailable } from "lib/mockDraft/research";
import type { MockFlags } from "lib/mockDraft/flags";
import DraftBoard from "./DraftBoard";
import DraftSummaryModal from "./DraftSummaryModal";
import MockAdpBoard from "./MockAdpBoard";
import styles from "./MockDraftWorkspace.module.scss";

export default function MockDraftWorkspace({
  league,
  players,
  flags,
  prorate84,
  onExit,
}: {
  league: MockLeague;
  players: ProcessedPlayer[];
  flags: MockFlags;
  prorate84: boolean;
  onExit: () => void;
}) {
  const { user } = useAuth(),
    access = useDraftProAccess();
  const mock = useMockDraft(user?.id ?? null, flags.collection),
    s = mock.session;
  const [tab, setTab] = useState("practice"),
    [config, setConfig] = useState<MockConfig>(() => ({
      ...league,
      userSeat: 0,
      seconds: 30,
      timeout: "autopick",
      tier: "free",
      bots: makeRoom({ ...league, tier: "free" }, "initial"),
    }));
  const [consent, setConsent] = useState(true),
    [error, setError] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [position, setPosition] = useState(""),
    [summary, setSummary] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pro =
    access.access?.capabilities.includes("mock_draft_advanced") === true;
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  const view = useMemo(() => (s ? dashboardView(s) : null), [s]);
  const pool = useMemo(
    () =>
      s
        ? available(s)
            .sort((a, b) => b.value - a.value)
            .filter(
              (p) =>
                p.name.toLowerCase().includes(search.toLowerCase()) &&
                (!position || p.positions.includes(position)),
            )
        : [],
    [s, search, position],
  );
  const currentSeat = s ? seatAt(s.picks.length + 1, s.config.teamCount) : 0;
  const positions = Object.keys(config.roster).filter(
    (p) => !["bench", "utility"].includes(p) && config.roster[p] > 0,
  );
  return (
    <div
      className={styles.workspace}
      role="dialog"
      aria-modal="true"
      aria-label="Practice Mock Draft"
      tabIndex={-1}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !summary) {
          mock.pause();
          onExit();
        }
        if (e.key === "Tab") {
          const elements = Array.from(
            root.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary",
            ) ?? [],
          ).filter((el) => el.getClientRects().length);
          const first = elements[0],
            last = elements.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === root.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <h1>Practice / Mock Draft</h1>
          <p>One seat is yours. Every other GM has a strategy.</p>
        </div>
        <button
          onClick={() => {
            mock.pause();
            onExit();
          }}
        >
          Exit practice
        </button>
      </header>
      <nav className={styles.controls} aria-label="Practice views">
        <button
          aria-pressed={tab === "practice"}
          onClick={() => setTab("practice")}
        >
          Mock draft
        </button>
        {flags.board && (
          <button
            aria-pressed={tab === "adp"}
            onClick={() => {
              mock.pause();
              setTab("adp");
            }}
          >
            Human Mock ADP
          </button>
        )}
      </nav>
      {tab === "adp" ? (
        <MockAdpBoard league={s?.config ?? league} />
      ) : (
        <>
          {(mock.error || error) && (
            <p role="alert" className={styles.notice}>
              {error ?? mock.error}{" "}
              <button onClick={() => void mock.retrySave()}>Retry save</button>
            </p>
          )}
          {mock.syncError && (
            <p role="status" className={styles.notice}>
              ADP sync: {mock.syncError} Your practice can continue; pending
              picks remain saved locally.
            </p>
          )}
          {!mock.ready ? (
            <p>Opening local mock…</p>
          ) : !mock.owns ? (
            <p className={styles.notice}>
              Take control in this tab to start or resume a mock. Another tab
              will pause.{" "}
              <button onClick={() => void mock.takeover()}>
                Take over in this tab
              </button>
            </p>
          ) : null}
          {!s ? (
            <div className={styles.setupLayout}>
              <div className={styles.setupSettings}>
              <p>
                Redraft snake · League settings copied from your dashboard.
                Keepers and traded picks are excluded. Edit scoring and roster
                settings in the dashboard before starting.
              </p>
              <div className={styles.setup}>
                <label>
                  Teams{" "}
                  <input
                    type="number"
                    min={2}
                    max={40}
                    value={config.teamCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      if (count >= 2 && count <= 40)
                        setConfig((c) => ({
                          ...c,
                          teamCount: count,
                          userSeat: Math.min(c.userSeat, count - 1),
                          bots: makeRoom(
                            { ...c, teamCount: count },
                            crypto.randomUUID(),
                          ),
                        }));
                    }}
                  />
                </label>
                <label>
                  Your seat{" "}
                  <select
                    value={config.userSeat}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        userSeat: Number(e.target.value),
                      }))
                    }
                  >
                    {Array.from({ length: config.teamCount }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        userSeat: Math.floor(Math.random() * c.teamCount),
                      }))
                    }
                  >
                    Randomize
                  </button>
                </label>
                <label>
                  Pick clock{" "}
                  <select
                    value={config.seconds}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        seconds: Number(e.target.value),
                      }))
                    }
                  >
                    {[15, 30, 60, 90, 120].map((v) => (
                      <option key={v} value={v}>
                        {v} seconds
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  When your clock expires{" "}
                  <select
                    value={config.timeout}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        timeout: e.target.value as MockConfig["timeout"],
                      }))
                    }
                  >
                    <option value="autopick">
                      Autopick from queue, then roster needs
                    </option>
                    <option value="pause">Pause and wait</option>
                  </select>
                </label>
                <label>
                  Bot intelligence{" "}
                  <select
                    value={config.tier}
                    onChange={(e) => {
                      const tier = e.target.value as "free" | "pro";
                      setConfig((c) => ({
                        ...c,
                        tier,
                        bots: makeRoom({ ...c, tier }, crypto.randomUUID()),
                      }));
                    }}
                  >
                    <option value="free">Free · four core profiles</option>
                    <option value="pro" disabled={!pro}>
                      Draft Pro · advanced strategies{!pro ? " (locked)" : ""}
                    </option>
                  </select>
                </label>
              </div>

              {flags.collection && (
                <p>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!user}
                      checked={!!user && consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Contribute my explicit picks to Human Mock ADP.
                  </label>{" "}
                  {user
                    ? "Automatic picks are excluded. You can opt out or withdraw this session."
                    : "Sign in to contribute; guests can practice freely."}
                </p>
              )}
              <button
                className={styles.primaryAction}
                disabled={!mock.ready || !mock.owns || !players.length}
                onClick={() => {
                  try {
                    leagueOf(config);
                    const frozen = freezePlayers(players, config, prorate84);
                    const next = newSession(
                      config,
                      frozen,
                      crypto.randomUUID(),
                      crypto.randomUUID(),
                      flags.collection && user && consent ? user.id : null,
                      flags.collection && !!user && consent,
                    );
                    void mock.start(next);
                    setError(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Start mock draft
              </button>
              </div>
              <section className={styles.panel}>
                <div className={styles.header}>
                  <h2>Your draft room</h2>
                  <button
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        bots: makeRoom(c, crypto.randomUUID()),
                      }))
                    }
                  >
                    Reroll room
                  </button>
                </div>
                <div className={styles.room}>
                  {config.bots.map((bot, i) =>
                    i === config.userSeat ? (
                      <p key={i}>Seat {i + 1} · You</p>
                    ) : (
                      <div key={i}>
                        <label>
                          Seat {i + 1}{" "}
                          <select
                            value={bot.personality}
                            onChange={(e) =>
                              setConfig((c) => ({
                                ...c,
                                bots: c.bots.map((b, j) =>
                                  j === i
                                    ? {
                                        ...b,
                                        personality: e.target
                                          .value as Personality,
                                      }
                                    : b,
                                ),
                              }))
                            }
                          >
                            {personalities.map((p) => (
                              <option
                                key={p}
                                value={p}
                                disabled={
                                  (p === "Contrarian" && !researchAvailable(config.season)) ||
                                  (config.tier === "free" &&
                                    !freePersonalities.includes(p))
                                }
                              >
                                {p}
                                {p === "Contrarian" && !researchAvailable(config.season)
                                  ? " · Research unavailable for this season"
                                  : config.tier === "free" &&
                                      !freePersonalities.includes(p)
                                    ? " · Pro"
                                    : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        {["Fade", "Reach"].includes(bot.personality) && (
                          <label>
                            Position{" "}
                            <select
                              value={bot.position}
                              onChange={(e) =>
                                setConfig((c) => ({
                                  ...c,
                                  bots: c.bots.map((b, j) =>
                                    j === i
                                      ? { ...b, position: e.target.value }
                                      : b,
                                  ),
                                }))
                              }
                            >
                              {positions.map((p) => (
                                <option key={p}>{p}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    ),
                  )}
                </div>
                <p>
                  Pro adds scarcity, turn planning, and specialist strategies.{" "}
                  <a href="/account?section=draft-pro">Explore Draft Pro</a>
                </p>
              </section>
            </div>
          ) : (
            view && (
              <>
                <div className={styles.controls}>
                  <strong aria-live="polite">
                    {s.status === "complete"
                      ? "Draft complete"
                      : `Pick ${s.picks.length + 1} · ${currentSeat === s.config.userSeat ? "Your turn" : `GM ${currentSeat + 1}`}`}
                  </strong>
                  <span>
                    {s.status} · {mock.clock}s
                  </span>
                  <button
                    disabled={!mock.owns || s.status === "complete"}
                    onClick={() =>
                      s.status === "running" ? mock.pause() : void mock.resume()
                    }
                  >
                    {s.status === "running" ? "Pause" : "Resume"}
                  </button>
                  <button
                    disabled={
                      !mock.owns ||
                      currentSeat === s.config.userSeat ||
                      s.status === "complete"
                    }
                    onClick={mock.fastForward}
                  >
                    Fast-forward to my turn
                  </button>
                  <button
                    disabled={!mock.owns}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Start a new mock? This replaces the locally saved mock.",
                        )
                      )
                        mock.restart();
                    }}
                  >
                    Restart
                  </button>
                  <button onClick={() => setSummary(true)}>
                    Draft summary
                  </button>
                </div>
                {s.contributor && (
                  <div className={styles.controls}>
                    <label>
                      <input
                        type="checkbox"
                        disabled={
                          !mock.owns ||
                          s.withdrawn ||
                          user?.id !== s.contributor
                        }
                        checked={s.consent && !s.withdrawn}
                        onChange={(e) => mock.consent(e.target.checked)}
                      />
                      Contribute future human picks
                    </label>
                    <button
                      disabled={
                        !mock.owns || s.withdrawn || user?.id !== s.contributor
                      }
                      onClick={mock.withdraw}
                    >
                      {s.withdrawn
                        ? "Contribution withdrawn / queued"
                        : "Withdraw this session’s contributions"}
                    </button>
                  </div>
                )}
                <DraftBoard
                  {...view}
                  myTeamId={String(s.config.userSeat)}
                  currentTurn={{
                    round: Math.ceil((s.picks.length + 1) / s.config.teamCount),
                    pickInRound: (s.picks.length % s.config.teamCount) + 1,
                    teamId: String(currentSeat),
                    isMyTurn: currentSeat === s.config.userSeat,
                  }}
                  onUpdateTeamName={() => {}}
                  canEditTeamNames={false}
                />
                <div className={styles.columns}>
                  <section>
                    <h2>Available players</h2>
                    <div className={styles.controls}>
                      <label>
                        Search{" "}
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <label>
                        Position{" "}
                        <select
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                        >
                          {["", "C", "LW", "RW", "FWD", "D", "G"].map((p) => (
                            <option key={p} value={p}>
                              {p || "All"}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className={styles.scroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Value</th>
                            <th>ADP</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pool.slice(0, 100).map((p) => (
                            <tr key={p.id}>
                              <td>
                                {p.name}
                                <br />
                                <small>
                                  {p.team} · {p.positions.join("/")}
                                </small>
                              </td>
                              <td>{p.value.toFixed(1)}</td>
                              <td>{p.adp?.toFixed(1) ?? "—"}</td>
                              <td>
                                <button
                                  className={styles.primaryAction}
                                  disabled={
                                    !mock.owns ||
                                    s.status !== "running" ||
                                    currentSeat !== s.config.userSeat
                                  }
                                  onClick={() => mock.pick(p.id)}
                                >
                                  Draft
                                </button>{" "}
                                <button
                                  disabled={
                                    !mock.owns || s.queue.includes(p.id)
                                  }
                                  onClick={() => mock.queue([...s.queue, p.id])}
                                >
                                  Queue
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Showing {Math.min(100, pool.length)} of {pool.length};
                      search to find more players.
                    </p>
                  </section>
                  <aside>
                    <h2>Your pick queue</h2>
                    <ol>
                      {s.queue.map((id, i) => (
                        <li key={id}>
                          {s.players.find((p) => p.id === id)?.name}{" "}
                          <button
                            disabled={!mock.owns || i === 0}
                            aria-label="Move player up"
                            onClick={() => {
                              const next = [...s.queue];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              mock.queue(next);
                            }}
                          >
                            ↑
                          </button>{" "}
                          <button
                            disabled={!mock.owns}
                            onClick={() =>
                              mock.queue(s.queue.filter((v) => v !== id))
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ol>
                    <h2>Pick history</h2>
                    <ol reversed>
                      {[...s.picks].reverse().map((p) => (
                        <li key={p.pick} value={p.pick}>
                          {s.players.find((v) => v.id === p.playerId)?.name} ·{" "}
                          {p.source}
                          {s.config.tier === "pro" && (
                            <p>{p.reasons.join(" · ")}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </aside>
                </div>
                <DraftSummaryModal
                  {...view}
                  myTeamId={String(s.config.userSeat)}
                  isOpen={summary}
                  onClose={() => setSummary(false)}
                  forwardGrouping={s.config.grouping}
                />
                <small>
                  Engine {ENGINE_VERSION} · Research{" "}
                  {s.researchVersion ?? "pending"}. Settings and projections are
                  frozen for this mock.
                </small>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
