import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ArticleNewsletter from "components/ArticleNewsletter/ArticleNewsletter";
import type { PostPreviewData } from "pages/blog";
import type { ArticleHeading } from "./headings";
import styles from "styles/Post.module.scss";

type Props = {
  title: string;
  summary?: string;
  author?: string;
  authorImage?: string;
  publishedAt?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageFit?: "contain" | "cover";
  topics?: string[];
  sourceUrl?: string;
  unoptimizedImage?: boolean;
  headings: ArticleHeading[];
  related?: PostPreviewData[];
  children: ReactNode;
  interactions?: ReactNode;
};

export function ArticleShare({ title }: { title: string }) {
  const [status, setStatus] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function share() {
    const url = `${window.location.origin}${window.location.pathname}`;
    setBusy(true);
    setStatus("");
    setManualUrl("");
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          setStatus("Share completed.");
          return;
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            setStatus("Share canceled.");
            return;
          }
        }
      }
      await navigator.clipboard.writeText(url);
      setStatus("Article link copied.");
    } catch {
      setStatus("Copy this link to share the article.");
      setManualUrl(url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.share}>
      <button type="button" onClick={share} disabled={busy}>
        ↗ {busy ? "Sharing…" : "Share article"}
      </button>
      <span role="status">{status}</span>
      {manualUrl && (
        <input
          aria-label="Article link to copy"
          value={manualUrl}
          readOnly
          onFocus={(event) => event.target.select()}
        />
      )}
    </div>
  );
}

export default function ArticleReader(props: Props) {
  const {
    title,
    summary,
    author,
    authorImage,
    publishedAt,
    imageUrl,
    imageAlt,
    topics = [],
    sourceUrl,
    unoptimizedImage,
    headings,
    related = [],
    children,
    interactions
  } = props;
  const contentsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (contentsRef.current) contentsRef.current.open = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [headings.length]);
  const date =
    publishedAt && Number.isFinite(Date.parse(publishedAt))
      ? new Date(publishedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
        })
      : "";
  const initials = author
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const byline = author && (
    <div className={styles.byline}>
      <span className={styles.avatar}>
        {authorImage ? (
          <Image src={authorImage} width={40} height={40} alt="" />
        ) : (
          initials
        )}
      </span>
      <span>
        {author}
        {date && <time dateTime={publishedAt}>{date}</time>}
      </span>
    </div>
  );
  return (
    <div className={styles.reader}>
      <Link href="/blog" className={styles.backLink}>
        ← Back to articles
      </Link>
      <article className={styles.editorialArticle}>
        <header className={styles.readerHeader}>
          {topics.length > 0 && (
            <p className={styles.eyebrow}>{topics.join(" · ")}</p>
          )}
          <h1>{title}</h1>
          {summary && <p className={styles.summary}>{summary}</p>}
          <div className={styles.metadata}>
            {byline || (date && <time dateTime={publishedAt}>{date}</time>)}
            <ArticleShare title={title} />
          </div>
        </header>
        <div className={styles.readingGrid}>
          {imageUrl && (
            <figure className={styles.hero} data-fit={props.imageFit || "contain"}>
              <Image
                src={imageUrl}
                alt={imageAlt || title}
                width={1200}
                height={675}
                priority
                unoptimized={unoptimizedImage}
                sizes="(max-width: 1023px) 100vw, 740px"
              />
            </figure>
          )}
          {headings.length > 0 && (
            <details ref={contentsRef} className={styles.contents}>
              <summary>In this article</summary>
              <nav aria-label="In this article">
                <ul>
                  {(headings.some((heading) => heading.level === 2) ? headings.filter((heading) => heading.level === 2) : headings).map((heading) => (
                    <li key={heading.id} data-level={heading.level}>
                      <a href={`#${encodeURIComponent(heading.id)}`}>
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}
          <div className={styles.readerBody}>{children}</div>
          {(author || sourceUrl) && (
            <footer className={styles.provenance}>
              {byline}
              {sourceUrl && (
                <a href={sourceUrl}>Originally published on Substack</a>
              )}
            </footer>
          )}
        </div>
      </article>
      <ArticleNewsletter variant="reader" />
      {related.length > 0 && (
        <section
          className={styles.keepReading}
          aria-labelledby="keep-reading-heading"
        >
          <div className={styles.relatedHeader}>
            <h2 id="keep-reading-heading">
              Keep <span>reading</span>
            </h2>
            <Link href="/blog">All articles →</Link>
          </div>
          <div className={styles.relatedGrid}>
            {related.slice(0, 2).map((post) => (
              <Link
                className={styles.relatedCard}
                key={post.slug}
                href={`/blog/${post.slug}`}
              >
                {post.imageUrl && (
                  <Image
                    src={post.imageUrl}
                    alt=""
                    width={112}
                    height={96}
                    unoptimized={post.unoptimizedImage}
                    sizes="112px"
                  />
                )}
                <div>
                  {!!post.topics?.length && (
                    <p className={styles.eyebrow}>{post.topics.join(" · ")}</p>
                  )}
                  <h3>{post.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {interactions && (
        <div className={styles.readerInteractions}>{interactions}</div>
      )}
    </div>
  );
}
