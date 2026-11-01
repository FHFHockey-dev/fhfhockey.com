/* eslint-disable @next/next/no-img-element -- The examples are already optimized WebP files; next/image would add Vercel image optimization runs for no gain. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LANDING_CATEGORIES, LANDING_DAYS, LANDING_MISC, landingCard, landingCardHref, landingCardImage, landingToday, landingWeekStart, readLandingChecklist, writeLandingChecklist } from "lib/socialShare/landingCatalog";
import styles from "./SocialShare.module.scss";
import landing from "./ShareLanding.module.scss";

const SORT_KEY = "fhfh-social-share-landing-sort", CHECKLIST_KEY = "fhfh-social-share-landing-checklist";
const IMAGE_WIDTH = 540, IMAGE_HEIGHT = 540;
type Sort = "category" | "day";

// Storage can be blocked or empty; the page works without it and simply remembers nothing.
const readStored = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const writeStored = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* Not remembered. */ } };

function Tile({ id, check }: { id: string; check?: { key: string; done: boolean; toggle: (key: string) => void } }) {
  const card = landingCard(id)!;
  const image = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);
  // A failure before hydration fires no React error event, so look once on mount as well.
  useEffect(() => { if (image.current?.complete && !image.current.naturalWidth) setMissing(true); }, []);
  return <article className={landing.tile} data-testid="landing-tile" data-card={id}>
    <Link href={landingCardHref(card)} prefetch={false} className={landing.tileLink}>
      <span className={landing.frame}>
        {missing ? <span className={landing.placeholder} data-testid="landing-placeholder">No example yet</span>
          : <img ref={image} src={landingCardImage(card)} alt="" loading="lazy" decoding="async" width={IMAGE_WIDTH} height={card.height ?? IMAGE_HEIGHT} onError={() => setMissing(true)} />}
        <span className={landing.badge}>{card.example === "fixture" ? "Example · fixture" : "Example"}</span>
      </span>
      <strong>{card.name}</strong>
      <span className={landing.purpose}>{card.purpose}</span>
    </Link>
    {check && <label className={landing.check}><input type="checkbox" checked={check.done} onChange={() => check.toggle(check.key)} /> Done this week<span className={landing.visuallyHidden}>: {card.name}</span></label>}
  </article>;
}

export default function ShareLanding() {
  const [sort, setSort] = useState<Sort>("category");
  const [week, setWeek] = useState("");
  const [today, setToday] = useState("");
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  const refreshWeek = useCallback(() => {
    const now = new Date(), current = landingWeekStart(now);
    setWeek(current); setToday(landingToday(now)); setDone(readLandingChecklist(readStored(CHECKLIST_KEY), current));
  }, []);
  // Stored choices load after mount so the server and first client render agree. A tab left open picks up a new week on return.
  useEffect(() => {
    if (readStored(SORT_KEY) === "day") setSort("day");
    refreshWeek();
    const onVisible = () => { if (document.visibilityState === "visible") refreshWeek(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshWeek]);

  const chooseSort = (next: Sort) => { setSort(next); writeStored(SORT_KEY, next); };
  const toggle = (key: string) => {
    const current = landingWeekStart(new Date()), next = new Set(current === week ? done : []);
    if (!next.delete(key)) next.add(key);
    setWeek(current); setDone(next); writeStored(CHECKLIST_KEY, writeLandingChecklist(current, next));
  };
  const checkFor = (bucket: string, id: string) => { const key = `${bucket}:${id}`; return { key, done: done.has(key), toggle }; };

  return <div className={landing.landing}><div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>Build a card</h1><p>Pick a card to open it in its studio.</p></div>
      <span className={styles.scope}>Nothing is scheduled or published from here.</span>
    </header>
    <div className={landing.sort} role="group" aria-label="Sort cards">
      <button type="button" aria-pressed={sort === "category"} onClick={() => chooseSort("category")}>By category</button>
      <button type="button" aria-pressed={sort === "day"} onClick={() => chooseSort("day")}>By day</button>
    </div>
    {sort === "category" ? LANDING_CATEGORIES.map(category => <section key={category.id} className={landing.section} aria-labelledby={`landing-${category.id}`}>
      <h2 id={`landing-${category.id}`}>{category.label}</h2>
      <div className={landing.grid}>{category.cards.map(id => <Tile key={id} id={id} />)}</div>
    </section>) : <>
      <p className={landing.note}>A suggested week, not a schedule: nothing posts on its own. Checks stay in this browser and clear each Monday{week ? ` (this week started ${week})` : ""}.</p>
      <section className={landing.section} aria-labelledby="landing-misc">
        <h2 id="landing-misc">{LANDING_MISC.label} <small>{LANDING_MISC.theme}</small></h2>
        <div className={landing.misc} role="region" aria-labelledby="landing-misc" tabIndex={0} data-testid="landing-misc">{LANDING_MISC.cards.map(id => <Tile key={id} id={id} check={checkFor(LANDING_MISC.id, id)} />)}</div>
      </section>
      <div className={landing.days}>{LANDING_DAYS.map(day => <section key={day.id} className={landing.day} data-today={day.id === today || undefined} data-testid={`landing-day-${day.id}`} aria-labelledby={`landing-${day.id}`}>
        <h2 id={`landing-${day.id}`}>{day.label} <small>{day.theme}</small></h2>
        {day.cards.map(id => <Tile key={id} id={id} check={checkFor(day.id, id)} />)}
      </section>)}</div>
    </>}
  </div></div>;
}
