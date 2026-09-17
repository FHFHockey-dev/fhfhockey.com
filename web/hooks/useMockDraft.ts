import { useCallback, useEffect, useRef, useState } from "react";
import type { MockSession } from "lib/mockDraft/contracts";
import {
  available,
  canComplete,
  commitPick,
  decide,
  delayMs,
  seatAt,
} from "lib/mockDraft/engine";
import {
  acknowledgeContribution,
  pendingContributions,
  storedSession,
  writeSession,
} from "lib/mockDraft/storage";
import { mockRequest, syncContributions } from "lib/mockDraft/client";

export function useMockDraft(userId: string | null, collection: boolean) {
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [syncError, setSyncError] = useState<string | null>(null);
  const [owns, setOwns] = useState(false),
    [clock, setClock] = useState(0);
  const state = useRef<MockSession | null>(null),
    owner = useRef(""),
    deadline = useRef(0),
    fast = useRef(false),
    mounted = useRef(true),
    busy = useRef(false),
    expiry = useRef(0),
    authorizationEpoch = useRef(0),
    syncing = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const previousUser = useRef(userId);
  const publish = useCallback((value: MockSession | null) => {
    state.current = value;
    setSession(value);
  }, []);
  const persist = useCallback(
    async (value: MockSession | null, takeover = false) => {
      try {
        const ok = await writeSession(owner.current, value, takeover);
        if (!ok) {
          setOwns(false);
          fast.current = false;
          if (state.current)
            publish({
              ...state.current,
              status:
                state.current.status === "complete" ? "complete" : "paused",
            });
        }
        return ok;
      } catch {
        setError(
          "Local saving is unavailable. Keep this tab open; use Retry save before leaving.",
        );
        return false;
      }
    },
    [publish],
  );
  const update = useCallback(
    (value: MockSession) => {
      const previous = state.current;
      if (
        previous?.status === "running" &&
        value.status === "running" &&
        value.pending &&
        previous.pending === value.pending
      )
        value = {
          ...value,
          pending: {
            ...value.pending,
            remainingMs: Math.max(0, deadline.current - Date.now()),
          },
        };
      publish(value);
      void persist(value);
    },
    [persist, publish],
  );
  const pause = useCallback(() => {
    authorizationEpoch.current++;
    fast.current = false;
    const s = state.current;
    if (!s || s.status !== "running") return;
    update({
      ...s,
      status: "paused",
      pending: s.pending
        ? {
            ...s.pending,
            remainingMs: Math.max(0, deadline.current - Date.now()),
          }
        : null,
    });
  }, [update]);
  useEffect(() => {
    if (previousUser.current !== userId) {
      previousUser.current = userId;
      if (state.current?.config.tier === "pro") {
        expiry.current = 0;
        pause();
      }
    }
  }, [userId, pause]);
  useEffect(() => {
    mounted.current = true;
    owner.current = crypto.randomUUID();
    void storedSession()
      .then(async (s) => {
        if (!mounted.current) return;
        publish(s);
        const ok = await writeSession(owner.current, s);
        if (mounted.current) {
          setOwns(ok);
          setReady(true);
        }
      })
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
    channel.current =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("fhfh-mock-owner")
        : null;
    if (channel.current)
      channel.current.onmessage = (e) => {
        if (e.data !== owner.current) {
          pause();
          setOwns(false);
        }
      };
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      pause();
      channel.current?.close();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pause, publish]);
  const authorize = useCallback(async (s: MockSession) => {
    if (s.config.tier !== "pro") return;
    const access = await mockRequest("access", "POST", {});
    expiry.current = Math.min(
      access.expiresAt ? Date.parse(access.expiresAt) : Infinity,
      access.nextVerificationAt
        ? Date.parse(access.nextVerificationAt)
        : Date.now() + 60 * 60_000,
    );
  }, []);
  const resume = useCallback(async () => {
    const s = state.current;
    if (!s || !owns || s.status === "complete" || busy.current) return;
    busy.current = true;
    const epoch = ++authorizationEpoch.current;
    try {
      await authorize(s);
      if (
        state.current?.id === s.id &&
        epoch === authorizationEpoch.current &&
        !document.hidden &&
        mounted.current
      ) {
        setError(null);
        update({
          ...state.current,
          pending:
            state.current.pending && state.current.pending.remainingMs <= 0
              ? null
              : state.current.pending,
          status: "running",
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
    }
  }, [authorize, owns, update]);
  useEffect(() => {
    if (!session || session.status !== "running" || !owns) return;
    const s = session;
    if (s.config.tier === "pro" && Date.now() >= expiry.current) {
      pause();
      setError("Verify Draft Pro access with Resume to continue.");
      return;
    }
    try {
      const pick = s.picks.length + 1,
        humanTurn = seatAt(pick, s.config.teamCount) === s.config.userSeat;
      if (!s.pending) {
        const decision = humanTurn ? null : decide(s);
        update({
          ...s,
          pending: {
            pick,
            decision,
            remainingMs: humanTurn ? s.config.seconds * 1000 : delayMs(s),
          },
        });
        return;
      }
      if (humanTurn) fast.current = false;
      deadline.current =
        Date.now() + (fast.current && !humanTurn ? 0 : s.pending.remainingMs);
      setClock(Math.ceil((deadline.current - Date.now()) / 1000));
      const timer = window.setInterval(
        () => {
          const current = state.current;
          if (
            !current ||
            current.id !== s.id ||
            current.status !== "running" ||
            current.picks.length + 1 !== pick
          )
            return;
          if (
            document.hidden ||
            (current.config.tier === "pro" && Date.now() >= expiry.current)
          ) {
            pause();
            return;
          }
          setClock(
            Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
          );
          if (Date.now() < deadline.current) return;
          window.clearInterval(timer);
          if (humanTurn && current.config.timeout === "pause") {
            pause();
            return;
          }
          try {
            const queued = humanTurn
              ? current.queue
                  .map((id) => available(current).find((p) => p.id === id))
                  .find((p) => p && canComplete(current, p))
              : undefined;
            const decision = queued
              ? { playerId: queued.id, reasons: ["Your queue"] }
              : (current.pending?.decision ??
                decide(current, {
                  personality: "Conservative",
                  variation: 0.5,
                }));
            update(
              commitPick(
                current,
                decision.playerId,
                humanTurn ? "timeout" : "bot",
                decision.reasons,
                pick,
              ),
            );
          } catch (e) {
            pause();
            setError((e as Error).message);
          }
        },
        fast.current && !humanTurn ? 0 : 100,
      );
      return () => window.clearInterval(timer);
    } catch (e) {
      pause();
      setError((e as Error).message);
    }
  }, [session, owns, pause, update]);
  useEffect(() => {
    if (!userId || !owns) return;
    let cancelled = false;
    const sync = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        let failure: string | null = null;
        for (const pending of await pendingContributions(userId)) {
          if (cancelled) break;
          if (!collection && !pending.withdrawn) continue;
          try {
            await syncContributions(pending);
            await acknowledgeContribution(pending);
          } catch (e) {
            failure = (e as Error).message;
            if ((e as { status?: number }).status === 429) {
              await acknowledgeContribution(pending);
              if (state.current?.id === pending.id)
                update({ ...state.current, contributor: null, consent: false });
            }
          }
        }
        if (!cancelled) setSyncError(failure);
      } catch (e) {
        if (!cancelled) setSyncError((e as Error).message);
      } finally {
        syncing.current = false;
      }
    };
    const timer = setTimeout(sync, 1500),
      retry = setInterval(sync, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(retry);
    };
  }, [session, collection, userId, owns, update]);
  return {
    session,
    ready,
    error,
    syncError,
    owns,
    clock,
    pause,
    resume,
    async start(s: MockSession) {
      if (!owns || busy.current) return;
      busy.current = true;
      const epoch = ++authorizationEpoch.current;
      try {
        await authorize(s);
        if (
          !mounted.current ||
          epoch !== authorizationEpoch.current ||
          document.hidden
        )
          return;
        deadline.current = 0;
        update({ ...s, status: "running" });
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busy.current = false;
      }
    },
    async takeover() {
      const latest = await storedSession().catch(() => state.current);
      if (await persist(latest, true)) {
        publish(latest);
        setOwns(true);
        channel.current?.postMessage(owner.current);
      }
    },
    async retrySave() {
      if (await persist(state.current)) setError(null);
    },
    restart() {
      if (!owns) return;
      pause();
      publish(null);
      void persist(null);
    },
    fastForward() {
      const s = state.current;
      if (
        !s ||
        !owns ||
        seatAt(s.picks.length + 1, s.config.teamCount) === s.config.userSeat
      )
        return;
      fast.current = true;
      if (s.status === "paused") void resume();
      else update({ ...s });
    },
    pick(id: string) {
      const s = state.current;
      if (!s || !owns) return;
      try {
        update(
          commitPick(
            { ...s, consent: s.consent && s.contributor === userId },
            id,
            "human",
            ["Your selection"],
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    },
    queue(ids: string[]) {
      if (state.current && owns)
        update({ ...state.current, queue: [...new Set(ids)] });
    },
    consent(value: boolean) {
      if (state.current && owns) update({ ...state.current, consent: value });
    },
    withdraw() {
      if (state.current && owns)
        update({ ...state.current, withdrawn: true, consent: false });
    },
  };
}
