/* eslint-disable @next/next/no-img-element -- Native owned SVG is decoded and embedded by html-to-image for exact PNG exports. */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { bounded, captureSharePng, readyShareFonts, SHARE_SIZE, teamLogoDataUrl } from "lib/socialShare/export";
import { fetchEdition } from "lib/socialShare/editionFetch";
import { SHARE_BASIS_LABELS, SHARE_POST_GROUP_LABELS, choiceLabels, parseShareSettings, shareSettingLines, sharePostExportBlock, sharePostExportToken, sharePostShowsCard, shareHeadlineSize, type AnyShareModule, type ShareSettings, type ShareSettingField, type SharePostGroup, type SharePostSnapshot } from "lib/socialShare/modules/contract";
import { SHARE_MODULES } from "lib/socialShare/modules/registry";
import { PERIOD_CUSTOM } from "lib/socialShare/modules/shared/periodWindow";
import { SHARE_TIME_ZONE } from "lib/socialShare/types";
import PeriodControl from "./PeriodControl";
import styles from "./SocialShare.module.scss";
import postStyles from "./PostStudio.module.scss";

const FONT_ATTEMPTS = 3, FONT_RETRY_MS = 500;
/** A pause in typing before a typed number, date or text reloads the post. */
const TYPING_MS = 500;
const queryText = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const timeLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: SHARE_TIME_ZONE, timeZoneName: "short" }).format(new Date(value)) : "Not available";

/** A post's settings from the URL, or its defaults when the URL holds an invalid value. */
function settingsFromQuery(entry: AnyShareModule, query: Record<string, string | string[] | undefined>): ShareSettings {
  const known = Object.fromEntries(entry.fields.flatMap(field => query[field.id] === undefined ? [] : [[field.id, queryText(query[field.id])]]));
  try { return parseShareSettings(entry, known); } catch { return parseShareSettings(entry, {}); }
}
const fieldText = (value: ShareSettings[string]) => value === null ? "" : String(value);
const defaultNote = (field: ShareSettingField) => field.kind === "select" ? field.options.find(option => option.value === field.default)?.label ?? field.default : field.default === null || field.default === "" ? field.blank ?? "any" : field.kind === "text" && field.choices ? choiceLabels(field.choices, field.default) : String(field.default);
const STATE_LABELS: Record<SharePostSnapshot["state"], string> = { ready: "Ready", partial: "Partial data", stale: "Out of date", missing: "Not available", blocked: "Blocked" };
/** What typed text means for a field: a value to use, nothing yet (a cleared number with a default), or why it can never be one. */
function typedValue(field: ShareSettingField, text: string): { value: ShareSettings[string] } | { problem: string | null } {
  if (field.kind === "number") {
    if (text === "") return field.default === null ? { value: null } : { problem: null };
    const value = Number(text);
    return Number.isFinite(value) && value >= field.min && value <= field.max ? { value } : { problem: `Enter a number from ${field.min} to ${field.max}.` };
  }
  if (field.kind === "date") return { value: text === "" ? field.default : text };
  if (field.kind === "text" && text.length > (field.maxLength ?? 80)) return { problem: `Use ${field.maxLength ?? 80} characters or fewer.` };
  return { value: text };
}

/**
 * Full evidence every post inherits, printed beside the preview: sources with their as-of times, sample, strength,
 * cohort, coverage and active filters. A post cannot drop it because it only renders the body.
 */
export function PostEvidence({ entry, snapshot, settings }: { entry: AnyShareModule; snapshot: SharePostSnapshot; settings: ShareSettings }) {
  const { evidence } = snapshot, coverage = evidence.coverage;
  return <div className={postStyles.evidence} data-testid="post-evidence">
    <span><b>Source</b> {evidence.sources.length ? evidence.sources.map(source => `${source.name}${source.asOf ? ` through ${source.asOf}` : ""}${source.updatedAt ? ` (updated ${timeLabel(source.updatedAt)})` : ""}`).join(" · ") : "Not available"}</span>
    {evidence.sources.filter(source => source.state !== "ready" || source.reasons?.length).map(source => <span key={source.name} data-testid="post-source-issue"><b>{source.name}</b> {source.state}{source.reasons?.length ? `: ${source.reasons.join(" ")}` : ""}</span>)}
    <span><b>Sample</b> {evidence.sample} · <b>Strength</b> {evidence.strength} · <b>Cohort</b> {evidence.cohort}</span>
    {coverage && <span><b>Coverage</b> {coverage.observed}{coverage.expected === null ? "" : ` of ${coverage.expected}`} {coverage.unit}{coverage.missing ? ` · ${coverage.missing} missing` : ""}</span>}
    {entry.fields.length > 0 && <span><b>Settings</b> {shareSettingLines(entry.fields, settings).map(line => `${line.label}: ${line.value}`).join(" · ")}</span>}
  </div>;
}

/** The one line a PNG carries (TJ, 2026-10-31: less fine print on the card): sources through their dates, strength, coverage. */
export function postEvidenceLine({ sources, strength, coverage }: SharePostSnapshot["evidence"]) {
  const named = sources.length ? sources.map(source => `${source.name}${source.asOf ? ` through ${source.asOf}` : ""}`).join(" · ") : "Source not available";
  return [named, strength, coverage && `${coverage.observed}${coverage.expected === null ? "" : ` of ${coverage.expected}`} ${coverage.unit}${coverage.missing ? `, ${coverage.missing} missing` : ""}`].filter(Boolean).join(" · ");
}

function PostFrame({ entry, snapshot, settings, brandLogo, logos, Card }: { entry: AnyShareModule; snapshot: SharePostSnapshot; settings: ShareSettings; brandLogo: string | null; logos: Record<string, string | null>; Card: ComponentType<any> | null }) {
  const shows = sharePostShowsCard(snapshot);
  const headline = (entry.headline?.(settings, snapshot.data ?? null) ?? entry.title).toUpperCase();
  const watermark = snapshot.fixture ? "OFFLINE FIXTURE" : snapshot.state === "ready" ? SHARE_BASIS_LABELS[entry.basis] : snapshot.state === "partial" ? "PARTIAL · NOT FOR EXPORT" : "UNAVAILABLE";
  return <>
    <div className={`${styles.gridHeader} ${styles.compactHeader}`}>
      <div className={styles.gridBrand}>{brandLogo ? <img src={brandLogo} alt="FHFH" width="135" height="40" /> : <strong>FHFH</strong>}<span>FHFHOCKEY.COM</span></div>
      <div className={styles.gridTitle}><p>{entry.kicker?.(settings) ?? SHARE_POST_GROUP_LABELS[entry.group as SharePostGroup]}</p><h2 style={{ fontSize: shareHeadlineSize(headline) }}>{headline}</h2></div>
    </div>
    <div className={postStyles.postBody}>
      {shows && Card ? <Card snapshot={snapshot} data={snapshot.data} settings={settings} logos={logos} />
        : <div className={postStyles.unavailable} data-testid="post-unavailable"><strong>Not available</strong>{(snapshot.reasons.length ? snapshot.reasons : ["This post's sources are not ready."]).map(reason => <p key={reason}>{reason}</p>)}</div>}
    </div>
    <footer className={`${styles.gridFooter} ${postStyles.footer}`}>
      <p><span data-testid="post-evidence-line">{snapshot.state === "partial" && <span className={postStyles.warning}>{snapshot.reasons[0]} </span>}{postEvidenceLine(snapshot.evidence)}</span><strong className={styles.gridWatermark} data-testid="post-watermark">{watermark}</strong></p>
    </footer>
  </>;
}

export default function PostStudio() {
  const router = useRouter();
  const modules = useMemo(() => [...SHARE_MODULES.values()], []);
  const entry = SHARE_MODULES.get(queryText(router.query.post)) ?? modules[0];
  const [settings, setSettings] = useState<ShareSettings>(() => settingsFromQuery(entry, router.query));
  const [snapshot, setSnapshot] = useState<SharePostSnapshot | null>(null);
  const [Card, setCard] = useState<ComponentType<any> | null>(null);
  const [Panel, setPanel] = useState<ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [exporting, setExporting] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [scale, setScale] = useState(0);
  /** Typed text not yet a setting, and why, per field. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  /** Why the current settings were not sent: the post's own cross-field check. */
  const [held, setHeld] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const typing = useRef<ReturnType<typeof setTimeout>>();
  /** Settings as last set, so two changes in one event both land. */
  const latest = useRef(settings);
  latest.current = settings;
  const requestedLogos = useRef(new Set<string>());

  const serverQuery = useCallback((current: ShareSettings) => new URLSearchParams(entry.fields.flatMap(field => field.clientOnly || current[field.id] === null ? [] : [[field.id, String(current[field.id])]])), [entry]);
  const load = useCallback(async (current: ShareSettings) => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setFeedback("");
    try {
      const query = serverQuery(current).toString();
      const response = await bounded(fetchEdition(`/api/v1/social-share/posts/${entry.id}${query ? `?${query}` : ""}`), "This post's request timed out. Retry this edition.", 20000);
      if (!response.ok) throw new Error(response.body.error || "This post could not be loaded.");
      const [next, loaded, panel] = [response.body as unknown as SharePostSnapshot, await entry.card(), await entry.panel?.() ?? null];
      if (id !== requestId.current) return;
      setCard(() => loaded); setPanel(() => panel); setSnapshot(next);
    } catch (cause) { if (id === requestId.current) setError(cause instanceof Error ? cause.message : "This post is unavailable."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [entry, serverQuery]);

  /** Loads the post for these settings now or after a pause in typing; any response still out for older settings is dropped. */
  const refresh = useCallback((next: ShareSettings, wait = 0) => {
    clearTimeout(typing.current);
    requestId.current++;
    let reason = "";
    try { parseShareSettings(entry, Object.fromEntries(serverQuery(next)), "server"); } catch (cause) { reason = cause instanceof Error ? cause.message : "These settings are not valid."; }
    setHeld(reason);
    if (reason) { setLoading(false); return; }
    setLoading(true);
    if (wait) typing.current = setTimeout(() => void load(next), wait); else void load(next);
  }, [entry, serverQuery, load]);

  useEffect(() => {
    const requests = requestId, pending = typing;
    const next = settingsFromQuery(entry, router.query);
    setSettings(next); setSnapshot(null); setDrafts({}); setProblems({}); setHeld(""); void load(next);
    return () => { requests.current++; clearTimeout(pending.current); };
    // The URL mirrors settings below, so only a change of post starts a new edition here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, router.isReady]);
  useEffect(() => {
    if (!router.isReady) return;
    const query: Record<string, string> = { post: entry.id };
    for (const field of entry.fields) if (settings[field.id] !== null) query[field.id] = String(settings[field.id]);
    if (Object.keys(query).length === Object.keys(router.query).length && Object.entries(query).every(([key, value]) => queryText(router.query[key]) === value)) return;
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }, [router, entry, settings]);
  useEffect(() => {
    let live = true;
    (async () => {
      setAssetError("");
      try {
        // The stylesheet declaring the fonts can arrive just after this first runs, so one miss is not yet a failure.
        for (let attempt = 1; ; attempt++) {
          try { await readyShareFonts(); break; }
          catch (cause) { if (attempt === FONT_ATTEMPTS) throw cause; await new Promise(resolve => setTimeout(resolve, FONT_RETRY_MS)); if (!live) return; }
        }
        const image = new Image(); image.src = "/pictures/logo-fhfh.svg";
        try { await bounded(image.decode(), "Logo unavailable", 5000); if (live) setBrandLogo(image.naturalWidth ? image.src : null); }
        catch { if (live) setBrandLogo(null); }
        if (live) setAssetsReady(true);
      } catch (cause) { if (live) setAssetError(cause instanceof Error ? cause.message : "Preview assets unavailable."); }
    })();
    return () => { live = false; };
  }, [assetAttempt]);
  useEffect(() => {
    const missing = snapshot?.teams.filter(team => !requestedLogos.current.has(team)) ?? [];
    if (!missing.length) return;
    for (const team of missing) requestedLogos.current.add(team);
    void Promise.all(missing.map(async team => [team, await teamLogoDataUrl(team).catch(() => null)] as const)).then(entries => setLogos(current => ({ ...current, ...Object.fromEntries(entries) })));
  }, [snapshot]);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(entries => setScale(Math.min(1, entries[0].contentRect.width / SHARE_SIZE)));
    observer.observe(frame.current); return () => observer.disconnect();
  }, []);

  const squareReady = assetsReady && !!snapshot && snapshot.post === entry.id && snapshot.teams.every(team => team in logos) && (!sharePostShowsCard(snapshot) || !!Card);
  const previewShown = !!snapshot && squareReady;
  const exportBlock = snapshot && snapshot.post === entry.id ? sharePostExportBlock(entry, snapshot, settings) : "This post is not loaded yet.";
  const formFields = entry.fields.filter(field => !field.panelOnly && (!field.onlyForPeriod || settings.period === field.onlyForPeriod));
  /** A field hidden by the period no longer counts against the post. */
  const blocking = formFields.some(field => problems[field.id]);
  const canExport = !exportBlock && squareReady && !loading && !error && !blocking;
  const isChanged = (field: ShareSettingField) => (settings[field.id] ?? null) !== field.default && !(field.default === "" && settings[field.id] === null);
  const changedCount = formFields.filter(isChanged).length;
  /** Options start collapsed so the card sits higher (TJ, 2026-11-03); a wrong value opens them so its reason shows. */
  const optionsShown = optionsOpen || blocking;
  const token = snapshot ? sharePostExportToken(entry.fields, snapshot, settings) : "";
  const alt = snapshot?.data != null && snapshot.post === entry.id ? entry.altText(snapshot, snapshot.data, settings) : `FHFH ${entry.title}: not available.`;
  const groups = useMemo(() => [...new Set(modules.map(item => item.group as SharePostGroup))], [modules]);
  /** Sets fields, and reloads the post when any of them reaches the server. */
  const edit = (changes: ShareSettings, wait = 0) => {
    const next = { ...latest.current, ...changes };
    latest.current = next; setSettings(next); setFeedback("");
    if (Object.keys(changes).some(id => !entry.fields.find(field => field.id === id)?.clientOnly)) refresh(next, wait);
  };
  /** A select applies at once; typed text waits for a pause and is only sent once it is a valid value. */
  const change = (field: ShareSettingField, text: string) => {
    const typed = typedValue(field, text);
    if (field.kind !== "select") setDrafts(current => ({ ...current, [field.id]: text }));
    setProblems(current => { const { [field.id]: _, ...rest } = current; return "problem" in typed && typed.problem ? { ...rest, [field.id]: typed.problem } : rest; });
    if ("value" in typed) edit({ [field.id]: typed.value }, field.kind === "select" ? 0 : TYPING_MS);
  };
  /** Leaving a field shows its setting again, unless what was typed is wrong and still needs fixing. */
  const settle = (field: ShareSettingField) => { if (!problems[field.id]) setDrafts(({ [field.id]: _, ...rest }) => rest); };
  const pick = (id: string) => { void router.replace({ pathname: router.pathname, query: { post: id } }, undefined, { shallow: true, scroll: false }); };
  const shown = snapshot?.post === entry.id ? snapshot : null;
  const sync = loading ? "Updating…" : held || blocking ? "Not updated" : error ? "Update failed" : shown ? "Up to date" : "";

  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>Post library</h1><nav className={styles.studioNav} aria-label="Share studios"><Link href="/social-share" prefetch={false}>All cards</Link><Link href="/social-share/game-grid" prefetch={false}>Weekly schedule</Link><Link href="/social-share/tuesday-trends" prefetch={false}>Tuesday trends</Link></nav></div><span className={styles.scope}>Choose any post on any day. Nothing is scheduled or published from here.</span></header>
    <section className={`${styles.panel} ${postStyles.settings}`} aria-label="Post settings">
      {/* Wide screens: the post and its summary on the left, Timeframe and Options beside them, so the card sits higher. */}
      <div className={postStyles.lead}>
      <div className={postStyles.postRow}>
        <label className={postStyles.field}><span>Post</span>
          <select value={entry.id} disabled={exporting} onChange={event => pick(event.target.value)}>{groups.map(group => <optgroup key={group} label={SHARE_POST_GROUP_LABELS[group]}>{modules.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}</select>
        </label>
        <p className={postStyles.sync} aria-live="polite" data-testid="post-sync" data-state={loading ? "loading" : sync === "Up to date" ? "ready" : "held"}>{sync}</p>
      </div>
      <p className={postStyles.summary}>{entry.summary}{entry.suggestedUse ? ` ${entry.suggestedUse}` : ""}</p>
      </div>
      <div className={postStyles.groups}>
      {entry.periodControl && <fieldset className={postStyles.group}><legend>Timeframe</legend>
        <PeriodControl entry={entry} control={entry.periodControl} settings={settings} disabled={exporting} edition={snapshot} change={change} apply={edit} />
      </fieldset>}
      {formFields.length > 0 && <fieldset className={postStyles.group} data-testid="post-options">
        <legend><button type="button" className={postStyles.disclosure} aria-expanded={optionsShown} aria-controls="post-options-fields" onClick={() => setOptionsOpen(!optionsShown)}>
          Options{changedCount > 0 && <span className={postStyles.count}> · {changedCount} changed</span>}
        </button></legend>
        <div id="post-options-fields" className={postStyles.fields} hidden={!optionsShown}>{formFields.map(field => {
        const id = `post-field-${field.id}`, problem = problems[field.id], value = drafts[field.id] ?? fieldText(settings[field.id]);
        const changed = isChanged(field);
        // A fixed set to pick from is a checkbox group; it keeps its comma-joined value, in the field's own order.
        const chosen = field.kind === "text" && field.choices ? fieldText(settings[field.id]).split(",").filter(Boolean) : null;
        const toggle = (value: string, on: boolean) => field.kind === "text" && field.choices && change(field, field.choices.filter(choice => choice.value === value ? on : chosen!.includes(choice.value)).map(choice => choice.value).join(","));
        return <div key={field.id} className={postStyles.field} data-wide={field.kind === "text" || undefined} data-roomy={(field.kind === "select" && field.options.some(option => option.label.length > 18)) || undefined}>
          {field.kind === "text" && field.choices && chosen ? <fieldset className={postStyles.choices}><legend>{field.label}</legend>
            {/* The last one stays on: a post needs at least one. */}
            {field.choices.map(choice => { const on = chosen.includes(choice.value); return <label key={choice.value}><input type="checkbox" checked={on} disabled={exporting || (on && chosen.length === 1)} onChange={event => toggle(choice.value, event.target.checked)} />{choice.label}</label>; })}
          </fieldset> : <label><span>{field.label}</span>
            {field.kind === "select" ? <select value={fieldText(settings[field.id])} disabled={exporting} onChange={event => change(field, event.target.value)}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} inputMode={field.kind === "number" && (field.step ?? 1) % 1 === 0 ? "numeric" : undefined} min={field.kind === "number" ? field.min : undefined} max={field.kind === "number" ? field.max : undefined} step={field.kind === "number" ? field.step : undefined} value={value} disabled={exporting} aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : !changed && field.blank ? `${id}-blank` : undefined} onChange={event => change(field, event.target.value)} onBlur={() => settle(field)} />}
          </label>}
          {problem ? <small id={`${id}-problem`} className={postStyles.problem}>{problem}</small>
            : changed && <button type="button" className={postStyles.reset} disabled={exporting} onClick={() => { setDrafts(({ [field.id]: _, ...rest }) => rest); edit({ [field.id]: field.default }); }}>
              {/* Named in its text, not aria-label, so finding a field by its label never finds this button too. */}
              Reset<span className={postStyles.hidden}> {field.label}</span> to {defaultNote(field)}</button>}
          {!problem && !changed && field.blank && <small id={`${id}-blank`} className={postStyles.defaultNote}>Leave blank for {field.blank}.</small>}
        </div>;
      })}</div></fieldset>}
      </div>
    </section>
    <div className={styles.status} aria-live="polite">
      {/* Retry sits here while a card still shows, and inside the empty frame when none does: one Retry at a time. */}
      {error && <p role="alert">{error}{previewShown && <> <button type="button" disabled={loading || exporting} onClick={() => refresh(settings)}>Retry</button></>}</p>}
      {held && !(entry.periodControl && settings.period === PERIOD_CUSTOM) && <p data-testid="settings-held">Not updated: {held}</p>}
      {snapshot && !loading && snapshot.state !== "ready" && <p><b>{STATE_LABELS[snapshot.state]}</b>: {snapshot.reasons.join(" ")}</p>}
      {snapshot && !loading && exportBlock && snapshot.state === "ready" && <p>{exportBlock}{shown && (!shown.expiresAt || Date.parse(shown.expiresAt) <= Date.now()) && <> <button type="button" disabled={exporting} onClick={() => refresh(settings)}>Load a new edition</button></>}</p>}
      {/* Without fonts no card can show, so the asset Retry is always inside the empty frame. */}
      {assetError && <p role="alert">{assetError}</p>}
    </div>
    <div className={Panel && snapshot?.data != null && snapshot.post === entry.id ? postStyles.builder : undefined}>
    {Panel && snapshot?.data != null && snapshot.post === entry.id && <aside className={styles.panel} aria-label="Build this post"><Panel snapshot={snapshot} data={snapshot.data} settings={settings} logos={logos} change={(fieldId: string, value: ShareSettings[string]) => edit({ [fieldId]: value })} disabled={exporting} /></aside>}
    <section className={`${styles.panel} ${postStyles.previewPanel}`} aria-label="Graphic preview">
      <div className={styles.panelHeader}><h2>1080 × 1080 preview</h2><span>{entry.title}</span></div>
      {snapshot?.post === entry.id && !!snapshot.pageNotes?.length && <div className={postStyles.pageNotes} data-testid="post-page-notes" role="note" aria-label="Notes for this edition, not on the PNG">
        {snapshot.pageNotes.map(note => <p key={note}>{note}</p>)}
      </div>}
      {/* On a wide panel the evidence sits beside the card, its actions under it (TJ, 2026-11-06), instead of running the full width. */}
      <div className={postStyles.previewBody}>
      <div className={postStyles.previewMain}>
      <div className={styles.previewFrame} ref={frame} style={{ height: scale * SHARE_SIZE }}>
        {snapshot && squareReady && <div ref={preview} className={`${styles.square} ${styles.gridSquare}`} style={{ transform: `scale(${scale})` }} data-testid="share-square" role="img" aria-label={alt} data-export-token={token}>
          <PostFrame entry={entry} snapshot={snapshot} settings={settings} brandLogo={brandLogo} logos={logos} Card={Card} />
        </div>}
        {/* The frame keeps the card's size, so say what is missing instead of leaving an empty square. */}
        {!previewShown && <div className={styles.previewEmpty} data-testid="preview-empty">
          <p>{assetError ? "No preview: the fonts or logo did not load." : !assetsReady ? "Preparing local fonts and branding…" : held || blocking ? "No preview: these settings are not valid yet." : error ? "No preview: this post did not load." : "Loading this post…"}</p>
          {assetError ? <button type="button" onClick={() => setAssetAttempt(current => current + 1)}>Retry</button>
            : error && !held && !blocking && <button type="button" disabled={loading || exporting} onClick={() => refresh(settings)}>Retry</button>}
        </div>}
      </div>
      <div className={styles.actions}><button type="button" disabled={!canExport || exporting} onClick={async () => {
        if (!preview.current || !snapshot) return; setExporting(true); setFeedback("");
        const node = preview.current, captured = snapshot, capturedSettings = settings, expected = token;
        try {
          await captureSharePng(node, () => {
            const block = sharePostExportBlock(entry, captured, capturedSettings);
            if (block) throw new Error(block);
            if (node.getAttribute("data-export-token") !== expected) throw new Error("The preview changed after Download was clicked. Download again.");
          }, `fhfh-post-${entry.id}-${captured.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(-20)}.png`);
          setFeedback("PNG downloaded: 1080 × 1080.");
        } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "Download failed. Retry the same edition."); }
        finally { setExporting(false); }
      }}>{exporting ? "Creating PNG…" : "Download PNG"}</button>
      <button type="button" disabled={!snapshot || exporting} onClick={async () => {
        try { await navigator.clipboard.writeText(alt); setFeedback("Alt text copied."); }
        catch { setFeedback("Alt text could not be copied. Select and copy the text below."); }
      }}>Copy alt text</button></div><p role="status">{feedback}</p>
      </div>
      <div className={postStyles.previewSide}>
      {snapshot && <PostEvidence entry={entry} snapshot={snapshot} settings={settings} />}
      {snapshot && <p className={postStyles.defaultNote}>Edition {timeLabel(snapshot.generatedAt)}</p>}
      {snapshot && <details><summary>Suggested alt text</summary><p>{alt}</p></details>}
      </div>
      </div>
    </section>
    </div>
  </div>;
}
