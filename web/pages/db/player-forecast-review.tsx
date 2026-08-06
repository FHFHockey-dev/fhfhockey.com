import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase";
import styles from "styles/PlayerForecasts.module.scss";

type ConflictPayload = { success: boolean; conflicts: any[]; goalieObservations: any[]; message?: string };

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message ?? "Request failed.");
  return payload;
}

export default function PlayerForecastReviewPage() {
  const router = useRouter();
  const reviewToken = typeof router.query.reviewToken === "string" ? router.query.reviewToken : "";
  const conflictId = typeof router.query.conflictId === "string" ? router.query.conflictId : "";
  const [payload, setPayload] = useState<ConflictPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (reviewToken) params.set("reviewToken", reviewToken);
    if (conflictId) params.set("conflictId", conflictId);
    return params.toString();
  }, [reviewToken, conflictId]);
  const load = useCallback(
    () => request(`/api/v1/player-forecasts/conflicts?${query}`).then(setPayload).catch((caught) => setError(caught instanceof Error ? caught.message : String(caught))),
    [query],
  );
  useEffect(() => { if (router.isReady) void load(); }, [router.isReady, load]);
  const observations = new Map((payload?.goalieObservations ?? []).map((row) => [row.id, row]));
  const resolve = async (conflict: any, action: string, member?: any) => {
    setBusy(conflict.id); setError(null);
    try {
      await request("/api/v1/player-forecasts/conflicts", { method: "POST", body: JSON.stringify({ conflictId: conflict.id, action, selectedObservationId: member?.observation_id, selectedObservationType: member?.observation_type, reviewToken }) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(null); }
  };
  return <><Head><title>Player Forecast Review | FHFH</title><meta name="robots" content="noindex,nofollow" /></Head><main className={styles.page}><header className={styles.hero}><div><p className={styles.eyebrow}>Admin review</p><h1>Player Forecast Conflicts</h1><p>Resolve contradictory evidence without rewriting the original observations.</p></div></header>{error ? <div className={styles.error}>{error}</div> : null}<div className={styles.reviewList}>{(payload?.conflicts ?? []).map((conflict) => <section className={styles.panel} key={conflict.id}><div className={styles.panelHeader}><div><h2>{conflict.summary}</h2><p>{new Date(conflict.detected_at).toLocaleString()} · version {conflict.conflict_version}</p></div><span className={styles.gate}>Needs review</span></div><div className={styles.observations}>{(conflict.player_forecast_conflict_members ?? []).map((member: any) => { const observation = observations.get(member.observation_id) as any; return <article key={member.id}><strong>{observation?.raw_player_name ?? `Player ${observation?.player_id ?? "unknown"}`}</strong><span>{observation?.observation_status ?? member.observation_type}</span><span>{observation?.source_account ?? observation?.source_key ?? "unknown source"}</span><time>{observation?.available_at ? new Date(observation.available_at).toLocaleString() : ""}</time><button disabled={busy === conflict.id} onClick={() => resolve(conflict, "select_observation", member)}>Use this observation</button></article>; })}</div><div className={styles.actions}><button disabled={busy === conflict.id} onClick={() => resolve(conflict, "accept_mixture")}>Accept provisional mixture</button><button disabled={busy === conflict.id} onClick={() => resolve(conflict, "dismiss")}>Dismiss conflict</button></div></section>)}{payload && payload.conflicts.length === 0 ? <p className={styles.empty}>No unresolved conflicts.</p> : null}</div></main></>;
}
