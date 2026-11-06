/* eslint-disable @next/next/no-img-element -- The examples are already optimized WebP files; next/image would add Vercel image optimization runs for no gain. */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { LANDING_CATEGORIES, LANDING_DAYS, landingCard, landingCardHref, landingCardImage, landingDaySections, landingDayStatus, landingToday, landingWeekStart, readLandingChecklist, writeLandingChecklist, type LandingSection, type PostedUnavailable, type PostedWeek } from "lib/socialShare/landingCatalog";
import { fetchPostedWeek } from "lib/socialShare/postedWeekFetch";
import { SHARE_TIME_ZONE } from "lib/socialShare/types";
import styles from "./SocialShare.module.scss";
import landing from "./ShareLanding.module.scss";

const SORT_KEY = "fhfh-social-share-landing-sort", DAYS_KEY = "fhfh-social-share-landing-days";
const IMAGE_WIDTH = 540, IMAGE_HEIGHT = 540;
const STATUS_MARK = { done: "✅", missed: "❌", notYet: "❌", upcoming: "–", untracked: "–", noRecord: "–" };
const HAND_TEXT = { done: "marked done", missed: "not marked", notYet: "not marked", upcoming: "not here yet", untracked: "not here yet", noRecord: "not here yet" };
const POSTED_TEXT = { done: "posted", missed: "no post recorded", notYet: "not yet", upcoming: "not here yet", untracked: "before tracking began", noRecord: "no record" };
const seenDate = new Intl.DateTimeFormat("en-US", { timeZone: SHARE_TIME_ZONE, month: "short", day: "numeric" });
type Sort = "category" | "day";

// Storage can be blocked or empty; the page works without it and simply remembers nothing.
const readStored = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const writeStored = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* Not remembered. */ } };
const sectionTarget = (section: string) => `landing-section-${section}`, cardTarget = (section: string, card: string) => `landing-card-${section}-${card}`;

function Tile({ id, section }: { id: string; section: string }) {
  const card = landingCard(id)!;
  const image = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);
  // A failure before hydration fires no React error event, so look once on mount as well.
  useEffect(() => { if (image.current?.complete && !image.current.naturalWidth) setMissing(true); }, []);
  return <article id={cardTarget(section, id)} className={landing.tile} data-testid="landing-tile" data-card={id}>
    <Link href={landingCardHref(card)} prefetch={false} className={landing.tileLink}>
      <span className={landing.frame}>
        {missing ? <span className={landing.placeholder} data-testid="landing-placeholder">No example yet</span>
          : <img ref={image} src={landingCardImage(card)} alt="" loading="lazy" decoding="async" width={IMAGE_WIDTH} height={card.height ?? IMAGE_HEIGHT} onError={() => setMissing(true)} />}
        <span className={landing.badge}>{card.example === "fixture" ? "Example · fixture" : "Example"}</span>
      </span>
      <strong>{card.name}</strong>
      <span className={landing.purpose}>{card.purpose}</span>
    </Link>
  </article>;
}

/** The week strip when the automatic source answers: a read-only status, since there is nothing to mark. */
function PostedStrip({ posted, today }: { posted: PostedWeek; today: string | null }) {
  return <>
    <div className={landing.strip} role="list" aria-labelledby="landing-week" data-testid="landing-strip">
      {LANDING_DAYS.map(day => {
        const status = landingDayStatus(day.id, today, new Set(), posted), count = posted.days.find(entry => entry.id === day.id)?.posts ?? 0;
        return <div key={day.id} role="listitem" className={`${landing.stripDay} ${landing.postedDay}`} data-testid={`landing-strip-${day.id}`} data-status={status} data-today={day.id === today || undefined} aria-label={`${day.label}${day.id === today ? " (today)" : ""}: ${POSTED_TEXT[status]}${count > 1 ? `, ${count} posts` : ""}`}>
          <span>{day.label}</span><span aria-hidden="true">{STATUS_MARK[status]}</span>
          {(status === "notYet" || status === "noRecord") && <span className={landing.dayNote} aria-hidden="true">{POSTED_TEXT[status]}</span>}
        </div>;
      })}
    </div>
    <p className={landing.postedCards} data-testid="landing-posted-cards">
      <span>Posts by card, this week:</span>
      {posted.cards.map(card => <span key={card.card}>{card.name} {card.count}</span>)}
      {posted.unmatched > 0 && <span>Unmatched {posted.unmatched}</span>}
      {posted.undated > 0 && <span>No date {posted.undated}</span>}
      {!posted.cards.length && !posted.unmatched && !posted.undated && <span>None yet</span>}
    </p>
  </>;
}

function Section({ section }: { section: LandingSection }) {
  const toCard = (event: MouseEvent, card: string) => {
    const target = document.getElementById(cardTarget(section.id, card));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: "nearest", inline: "start" });
    target.querySelector("a")?.focus({ preventScroll: true });
  };
  const headingId = `landing-heading-${section.id}`;
  return <section id={sectionTarget(section.id)} tabIndex={-1} className={landing.section} data-testid={`landing-section-${section.id}`} aria-labelledby={headingId}>
    <h2 id={headingId}>{section.today ? "Today" : section.label}{(section.today || section.theme) && <small>{[section.today && section.label, section.theme].filter(Boolean).join(" · ")}</small>}</h2>
    <nav className={landing.chips} aria-label={`Cards in ${section.today ? "Today" : section.label}`}>
      {section.cards.map(id => <a key={id} className={landing.chip} href={`#${cardTarget(section.id, id)}`} onClick={event => toCard(event, id)}>{landingCard(id)!.name}</a>)}
    </nav>
    {/* Its own name: the section is already the region named by the heading (axe landmark-unique). */}
    <div className={landing.row} role="region" aria-label={`${section.today ? "Today" : section.label} card examples`} tabIndex={0} data-testid={`landing-row-${section.id}`}>
      {section.cards.map(id => <Tile key={id} id={id} section={section.id} />)}
    </div>
  </section>;
}

export default function ShareLanding() {
  const [sort, setSort] = useState<Sort>("category");
  const [filter, setFilter] = useState("all");
  const [week, setWeek] = useState("");
  const [today, setToday] = useState<string | null>(null);
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  // Undefined while the first answer is pending; anything but a PostedWeek leaves the strip on hand marking.
  const [source, setSource] = useState<PostedWeek | PostedUnavailable | "failed" | null | undefined>(undefined);

  const refreshWeek = useCallback(() => {
    const now = new Date(), current = landingWeekStart(now);
    setWeek(current); setToday(landingToday(now)); setMarked(readLandingChecklist(readStored(DAYS_KEY), current));
    fetchPostedWeek().then(setSource);
  }, []);
  // Stored choices and today load after mount so the server and first client render agree. A tab left open picks up a new day on return.
  useEffect(() => {
    if (readStored(SORT_KEY) === "day") setSort("day");
    refreshWeek();
    const onVisible = () => { if (document.visibilityState === "visible") refreshWeek(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshWeek]);

  // A tab left visible across midnight moves on by itself. refreshWeek is what changes `today` and `week`.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      if (landingToday(now) !== today || landingWeekStart(now) !== week) refreshWeek();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshWeek, today, week]);

  const chooseSort = (next: Sort) => { setSort(next); setFilter("all"); writeStored(SORT_KEY, next); };
  const toggleDay = (day: string) => {
    // The page may be up to a minute behind the clock. Go by the clock, and a day that has not come yet cannot be marked.
    const now = new Date(), current = landingWeekStart(now), currentToday = landingToday(now);
    if (current !== week || currentToday !== today) refreshWeek();
    if (landingDayStatus(day, currentToday, new Set()) === "upcoming") return;
    const next = new Set(current === week ? marked : readLandingChecklist(readStored(DAYS_KEY), current));
    if (!next.delete(day)) next.add(day);
    setWeek(current); setMarked(next); writeStored(DAYS_KEY, writeLandingChecklist(current, next));
  };
  // An answer for another week (a tab left open past Sunday) is not used while the new one loads.
  const posted = source && source !== "failed" && source.available && source.week === week ? source : null;
  const undatedOnly = source && source !== "failed" && !source.available ? source.undated : 0;
  const sections = sort === "category" ? LANDING_CATEGORIES : landingDaySections(today);
  const shown = sections.filter(section => filter === "all" || section.id === filter);
  const toSection = (event: MouseEvent, id: string) => {
    event.preventDefault();
    // While narrowed to one section the others are not on the page, so a jump moves the filter instead.
    if (filter !== "all") { setFilter(id); return; }
    const target = document.getElementById(sectionTarget(id));
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  };

  return <div className={landing.landing}><div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>Build a card</h1><p>Pick a card to open it in its studio.</p></div>
      <span className={styles.scope}>Nothing is scheduled or published from here.</span>
    </header>
    <section className={landing.week} aria-labelledby="landing-week">
      <h2 id="landing-week">This week <small>{posted ? `From @FHFHockey's posts, New York days. ${!posted.latest ? "No live delivery yet, so empty days have no record." : posted.stale ? `No live delivery since ${seenDate.format(new Date(posted.latest))}, so later days have no record.` : `Last live delivery ${seenDate.format(new Date(posted.latest))}.`}` : source === undefined ? "Checking posts." : `${source === "failed" ? "Could not read posts. " : ""}Marked by hand. Click a day to mark it. Stays in this browser and clears each Monday.`}</small></h2>
      {posted ? <PostedStrip posted={posted} today={today} /> : <div className={landing.strip} role="group" aria-labelledby="landing-week" data-testid="landing-strip">
        {LANDING_DAYS.map(day => {
          const status = source === undefined ? "upcoming" : landingDayStatus(day.id, today, marked);
          return <button key={day.id} type="button" className={landing.stripDay} data-testid={`landing-strip-${day.id}`} data-status={status} data-today={day.id === today || undefined} aria-pressed={status === "done"} aria-label={`${day.label}${day.id === today ? " (today)" : ""}: ${source === undefined ? "checking" : HAND_TEXT[status]}`} disabled={status === "upcoming"} onClick={() => toggleDay(day.id)}>
            <span>{day.label}</span><span aria-hidden="true">{STATUS_MARK[status]}</span>
          </button>;
        })}
      </div>}
      {undatedOnly > 0 && <p className={landing.postedCards} data-testid="landing-posted-undated"><span>Posts received with no date: {undatedOnly}</span></p>}
    </section>
    <nav className={landing.jump} aria-label="Jump to a section" data-testid="landing-jump">
      {sections.map(section => <a key={section.id} className={landing.chip} href={`#${sectionTarget(section.id)}`} aria-current={filter === section.id ? "true" : undefined} onClick={event => toSection(event, section.id)}>{section.today ? "Today" : section.label}</a>)}
    </nav>
    <div className={landing.controls}>
      <div className={landing.sort} role="group" aria-label="Sort cards">
        {/* Phones hide "By " visually (CATEGORY / DAY); it stays in the accessible name. */}
        <button type="button" aria-pressed={sort === "category"} onClick={() => chooseSort("category")}><span className={landing.sortBy}>By </span>category</button>
        <button type="button" aria-pressed={sort === "day"} onClick={() => chooseSort("day")}><span className={landing.sortBy}>By </span>day</button>
      </div>
      <label className={landing.filter}>Show
        <select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">All sections</option>
          {sections.map(section => <option key={section.id} value={section.id}>{section.today ? "Today" : section.label}</option>)}
        </select>
      </label>
    </div>
    {sort === "day" && <p className={landing.note}>A suggested week, not a schedule: nothing posts on its own.</p>}
    {shown.map(section => <Section key={section.id} section={section} />)}
  </div></div>;
}
