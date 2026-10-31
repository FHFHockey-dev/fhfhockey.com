/* eslint-disable @next/next/no-img-element -- Native owned SVG is decoded and embedded by html-to-image for exact PNG exports. */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { bounded, captureSharePng, readyShareFonts, SHARE_SIZE, teamLogoDataUrl } from "lib/socialShare/export";
import { fetchEdition } from "lib/socialShare/editionFetch";
import { SHARE_BASIS_LABELS, SHARE_POST_GROUP_LABELS, parseShareSettings, shareSettingLines, sharePostExportBlock, sharePostExportToken, sharePostShowsCard, type AnyShareModule, type ShareSettings, type ShareSettingField, type SharePostGroup, type SharePostSnapshot } from "lib/socialShare/modules/contract";
import { SHARE_MODULES } from "lib/socialShare/modules/registry";
import { SHARE_TIME_ZONE } from "lib/socialShare/types";
import styles from "./SocialShare.module.scss";
import postStyles from "./PostStudio.module.scss";

const FONT_ATTEMPTS = 3, FONT_RETRY_MS = 500;
const queryText = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const timeLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: SHARE_TIME_ZONE, timeZoneName: "short" }).format(new Date(value)) : "Not available";

/** A post's settings from the URL, or its defaults when the URL holds an invalid value. */
function settingsFromQuery(entry: AnyShareModule, query: Record<string, string | string[] | undefined>): ShareSettings {
  const known = Object.fromEntries(entry.fields.flatMap(field => query[field.id] === undefined ? [] : [[field.id, queryText(query[field.id])]]));
  try { return parseShareSettings(entry, known); } catch { return parseShareSettings(entry, {}); }
}
const fieldText = (value: ShareSettings[string]) => value === null ? "" : String(value);
const defaultNote = (field: ShareSettingField) => field.kind === "select" ? field.options.find(option => option.value === field.default)?.label ?? field.default : field.default === null || field.default === "" ? "any" : String(field.default);

/**
 * Evidence every post inherits, on screen and in the PNG: sources with their as-of times, sample, strength, cohort,
 * coverage and active filters. A post cannot drop them because it only renders the body.
 */
export function PostEvidence({ entry, snapshot, settings }: { entry: AnyShareModule; snapshot: SharePostSnapshot; settings: ShareSettings }) {
  const { evidence } = snapshot, coverage = evidence.coverage;
  return <div className={postStyles.evidence} data-testid="post-evidence">
    <span><b>Source</b> {evidence.sources.length ? evidence.sources.map(source => `${source.name}${source.asOf ? ` through ${source.asOf}` : ""}${source.updatedAt ? ` (updated ${timeLabel(source.updatedAt)})` : ""}`).join(" · ") : "Not available"}</span>
    <span><b>Sample</b> {evidence.sample} · <b>Strength</b> {evidence.strength} · <b>Cohort</b> {evidence.cohort}</span>
    {coverage && <span><b>Coverage</b> {coverage.observed}{coverage.expected === null ? "" : ` of ${coverage.expected}`} {coverage.unit}{coverage.missing ? ` · ${coverage.missing} missing` : ""}</span>}
    {entry.fields.length > 0 && <span><b>Settings</b> {shareSettingLines(entry.fields, settings).map(line => `${line.label}: ${line.value}`).join(" · ")}</span>}
  </div>;
}

function PostFrame({ entry, snapshot, settings, brandLogo, logos, Card }: { entry: AnyShareModule; snapshot: SharePostSnapshot; settings: ShareSettings; brandLogo: string | null; logos: Record<string, string | null>; Card: ComponentType<any> | null }) {
  const shows = sharePostShowsCard(snapshot);
  const watermark = snapshot.fixture ? "OFFLINE FIXTURE" : snapshot.state === "ready" ? SHARE_BASIS_LABELS[entry.basis] : snapshot.state === "partial" ? "PARTIAL · NOT FOR EXPORT" : "UNAVAILABLE";
  return <>
    <div className={`${styles.gridHeader} ${styles.compactHeader}`}>
      <div className={styles.gridBrand}>{brandLogo ? <img src={brandLogo} alt="FHFH" width="135" height="40" /> : <strong>FHFH</strong>}<span>FHFHOCKEY.COM</span></div>
      <div className={styles.gridTitle}><p>{SHARE_POST_GROUP_LABELS[entry.group as SharePostGroup]}</p><h2>{entry.title.toUpperCase()}</h2></div>
    </div>
    <div className={postStyles.postBody}>
      {shows && Card ? <Card snapshot={snapshot} data={snapshot.data} settings={settings} logos={logos} />
        : <div className={postStyles.unavailable} data-testid="post-unavailable"><strong>Not available</strong>{(snapshot.reasons.length ? snapshot.reasons : ["This post's sources are not ready."]).map(reason => <p key={reason}>{reason}</p>)}</div>}
    </div>
    <footer className={styles.gridFooter}>
      <PostEvidence entry={entry} snapshot={snapshot} settings={settings} />
      <p><span>{snapshot.state === "partial" ? <span className={postStyles.warning}>{snapshot.reasons[0]}</span> : `Edition ${timeLabel(snapshot.generatedAt)}`}</span><strong className={styles.gridWatermark} data-testid="post-watermark">{watermark}</strong></p>
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
  const preview = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const requestedLogos = useRef(new Set<string>());

  const serverQuery = useCallback((current: ShareSettings) => new URLSearchParams(entry.fields.flatMap(field => field.clientOnly || current[field.id] === null ? [] : [[field.id, String(current[field.id])]])), [entry]);
  const load = useCallback(async (current: ShareSettings) => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setFeedback("");
    try {
      const query = serverQuery(current).toString();
      const response = await bounded(fetchEdition(`/api/v1/social-share/posts/${entry.id}${query ? `?${query}` : ""}`), "This post's request timed out. Retry this edition.", 20000);
      if (!response.ok) throw new Error(response.body.error || "This post could not be loaded.");
      const [next, loaded] = [response.body as unknown as SharePostSnapshot, await entry.card()];
      if (id !== requestId.current) return;
      setCard(() => loaded); setSnapshot(next);
    } catch (cause) { if (id === requestId.current) setError(cause instanceof Error ? cause.message : "This post is unavailable."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [entry, serverQuery]);

  useEffect(() => {
    const requests = requestId;
    const next = settingsFromQuery(entry, router.query);
    setSettings(next); setSnapshot(null); void load(next);
    return () => { requests.current++; };
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
  const exportBlock = snapshot && snapshot.post === entry.id ? sharePostExportBlock(entry, snapshot, settings) : "This post is not loaded yet.";
  const canExport = !exportBlock && squareReady && !loading && !error;
  const token = snapshot ? sharePostExportToken(entry.fields, snapshot, settings) : "";
  const alt = snapshot?.data != null && snapshot.post === entry.id ? entry.altText(snapshot, snapshot.data, settings) : `FHFH ${entry.title}: not available.`;
  const groups = useMemo(() => [...new Set(modules.map(item => item.group as SharePostGroup))], [modules]);
  const change = (field: ShareSettingField, text: string) => {
    let value: ShareSettings[string] = text;
    if (field.kind === "number") { value = text === "" ? field.default : Number(text); if (value !== null && (!Number.isFinite(value) || value < field.min || value > field.max)) return; }
    if (field.kind === "date" && text === "") value = field.default;
    setSettings(current => ({ ...current, [field.id]: value })); setFeedback("");
  };
  const pick = (id: string) => { void router.replace({ pathname: router.pathname, query: { post: id } }, undefined, { shallow: true, scroll: false }); };

  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>Post library</h1><p><Link href="/social-share/game-grid" prefetch={false}>Weekly schedule studio</Link> · <Link href="/social-share/tuesday-trends" prefetch={false}>Tuesday trends</Link></p></div><span className={styles.scope}>Choose any post on any day. Nothing is scheduled or published from here.</span></header>
    <section className={styles.panel} aria-label="Post settings">
      <div className={styles.controls}>
        <label>Post<select value={entry.id} disabled={exporting} onChange={event => pick(event.target.value)}>{groups.map(group => <optgroup key={group} label={SHARE_POST_GROUP_LABELS[group]}>{modules.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}</select></label>
        <button type="button" disabled={loading || exporting} onClick={() => void load(settings)}>Refresh post</button>
      </div>
      <p>{entry.summary}{entry.suggestedUse ? ` ${entry.suggestedUse}` : ""}</p>
      {entry.fields.length > 0 && <div className={postStyles.fields}>{entry.fields.map(field => <label key={field.id}>{field.label}
        {field.kind === "select" ? <select value={fieldText(settings[field.id])} disabled={exporting} onChange={event => change(field, event.target.value)}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : <input type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} min={field.kind === "number" ? field.min : undefined} max={field.kind === "number" ? field.max : undefined} step={field.kind === "number" ? field.step : undefined} value={fieldText(settings[field.id])} disabled={exporting} onChange={event => change(field, event.target.value)} />}
        <small className={postStyles.defaultNote}>Default: {defaultNote(field)}</small></label>)}</div>}
    </section>
    <div className={styles.status} aria-live="polite">
      {loading && <p>Loading this post…</p>}
      {error && <p role="alert">{error} <button type="button" disabled={loading || exporting} onClick={() => void load(settings)}>Retry</button></p>}
      {snapshot && !loading && snapshot.state !== "ready" && <p>{snapshot.state}: {snapshot.reasons.join(" ")}</p>}
      {snapshot && !loading && exportBlock && snapshot.state === "ready" && <p>{exportBlock}</p>}
      {assetError && <p role="alert">{assetError} <button type="button" onClick={() => setAssetAttempt(current => current + 1)}>Retry</button></p>}
    </div>
    <section className={styles.panel} aria-label="Graphic preview">
      <div className={styles.panelHeader}><h2>1080 × 1080 preview</h2><span>{entry.title}</span></div>
      <div className={styles.previewFrame} ref={frame} style={{ height: scale * SHARE_SIZE }}>
        {snapshot && squareReady && <div ref={preview} className={`${styles.square} ${styles.gridSquare}`} style={{ transform: `scale(${scale})` }} data-testid="share-square" role="img" aria-label={alt} data-export-token={token}>
          <PostFrame entry={entry} snapshot={snapshot} settings={settings} brandLogo={brandLogo} logos={logos} Card={Card} />
        </div>}
        {!assetsReady && !assetError && <p>Preparing local fonts and branding…</p>}
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
      {snapshot && <details><summary>Suggested alt text</summary><p>{alt}</p></details>}
    </section>
  </div>;
}
