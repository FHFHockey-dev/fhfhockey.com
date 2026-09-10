////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\blog\index.tsx

import { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { urlFor } from "lib/sanity/sanity";

import Container from "components/Layout/Container";
import ArticleNewsletter from "components/ArticleNewsletter/ArticleNewsletter";
import styles from "styles/Blog.module.scss";
import { getSubstackPosts } from "lib/substack";

export type PostPreviewData = {
  slug: string;
  title: string;
  /** LocaleDateString retained for existing preview consumers. */
  createdAt: string;
  /** Source timestamp retained for stable sorting and display formatting. */
  publishedAt?: string;
  summary: string;
  /**
   * Preview image url.
   */
  imageUrl: string;
  unoptimizedImage?: boolean;
  author?: string;
  topics?: string[];
};

const postsQuery = groq`
  *[_type == "post" && !(_id in path("drafts.**")) && defined(slug.current) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    mainImage,
    publishedAt,
    summary,
    "author": author->name,
    "topics": categories[]->title,
  }
`;

const formatDate = (publishedAt: string) =>
  new Date(publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const fallbackImage = "/android-chrome-512x512.png";

export const getStaticProps: GetStaticProps = async () => {
  const sanityPosts = await getClient().fetch(postsQuery);
  const posts: PostPreviewData[] = sanityPosts.flatMap(
    ({
      slug,
      title,
      summary,
      publishedAt,
      mainImage,
      author,
      topics,
    }: Record<string, unknown>) => {
      if (
        typeof slug !== "string" ||
        typeof title !== "string" ||
        typeof publishedAt !== "string" ||
        !Number.isFinite(new Date(publishedAt).getTime())
      )
        return [];

      const preview: PostPreviewData = {
        slug,
        title,
        summary: typeof summary === "string" ? summary : "",
        publishedAt,
        createdAt: formatDate(publishedAt),
        imageUrl: mainImage && typeof mainImage === "object" && "asset" in mainImage ? urlFor(mainImage).url() : fallbackImage,
      };
      if (typeof author === "string") preview.author = author;
      if (Array.isArray(topics)) {
        const validTopics = topics.filter(
          (entry): entry is string => typeof entry === "string",
        );
        if (validTopics.length) preview.topics = validTopics;
      }
      return [preview];
    },
  );

  const substackPosts = await getSubstackPosts();
  posts.push(
    ...substackPosts.map((post) => {
      const preview: PostPreviewData = {
        slug: `substack/${post.slug}`,
        title: post.title,
        summary: post.summary,
        publishedAt: post.publishedAt,
        createdAt: formatDate(post.publishedAt),
        imageUrl: post.imageUrl || fallbackImage,
        unoptimizedImage: true,
      };
      if (post.author) preview.author = post.author;
      return preview;
    }),
  );
  posts.sort(
    (a, b) =>
      new Date(b.publishedAt || b.createdAt).getTime() -
      new Date(a.publishedAt || a.createdAt).getTime(),
  );

  return {
    props: {
      posts,
    },
    revalidate: 300,
  };
};

function PostImage({
  post,
  className,
  priority = false,
}: {
  post: PostPreviewData;
  className: string;
  priority?: boolean;
}) {
  return (
    <div className={className}>
      <Image
        alt=""
        src={post.imageUrl || fallbackImage}
        unoptimized={post.unoptimizedImage}
        fill
        priority={priority}
        sizes="(max-width: 767px) 100vw, (max-width: 1100px) 45vw, 560px"
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Blog: NextPage<{ posts: PostPreviewData[] }> = ({ posts }) => {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const featured = posts[0];
  const topics = useMemo(
    () =>
      Array.from(new Set(posts.flatMap((post) => post.topics || []))).sort(),
    [posts],
  );
  const archive = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return posts.slice(1).filter((post) => {
      const matchesQuery =
        !normalizedQuery ||
        [post.title, post.summary, post.author, ...(post.topics || [])]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return matchesQuery && (!topic || post.topics?.includes(topic));
    });
  }, [posts, query, topic]);
  const resetFilters = () => {
    setQuery("");
    setTopic("");
  };

  return (
    <Container contentVariant="full" className={styles.page}>
      <Head>
        <title>FHFH | Articles</title>
      </Head>
      <div className={styles.content}>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Five Hole Fantasy Hockey</p>
            <h1>
              FHFH <em>Articles</em>
            </h1>
          </div>
          <p className={styles.introCopy}>
            A deeper look at the game.
            <br />
            Analysis, insights, and practical fantasy hockey advice.
          </p>
        </header>
        {featured ? (
          <section className={styles.featured} aria-labelledby="latest-article">
            <div className={styles.featuredLabel}>
              <span id="latest-article">Latest article</span>
              {featured.topics?.[0] && <span>{featured.topics[0]}</span>}
            </div>
            <div className={styles.featuredContent}>
              <Link
                className={styles.featuredImageLink}
                aria-label={`Read ${featured.title}`}
                href={`/blog/${featured.slug}`}
              >
                <PostImage
                  post={featured}
                  className={styles.featuredImage}
                  priority
                />
              </Link>
              <div className={styles.featuredText}>
                <h2>
                  <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
                </h2>
                {featured.summary && (
                  <p className={styles.summary}>{featured.summary}</p>
                )}
                <p className={styles.byline}>
                  {featured.author && (
                    <>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(featured.author)}
                      </span>
                    </>
                  )}
                  <span className={styles.authorDetails}>
                    {featured.author}
                    <time dateTime={featured.publishedAt}>
                      {featured.createdAt}
                    </time>
                  </span>
                </p>
                <Link
                  className={styles.readButton}
                  href={`/blog/${featured.slug}`}
                >
                  Read article <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.emptyPublication}>
            <h2>No articles published yet.</h2>
            <p>Check back soon for the next FHFH article.</p>
          </section>
        )}
        <div className={styles.libraryGrid}>
          <section className={styles.archive} aria-labelledby="archive-heading">
            <div className={styles.archiveHeader}>
              <h2 id="archive-heading">
                From the <em>archive</em>
              </h2>
              <span>More from FHFH</span>
            </div>
            <div className={styles.filters}>
              <label className={styles.searchLabel}>
                <span>Search articles</span>
                <input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search articles"
                  type="search"
                />
              </label>
              {topics.length > 0 && (
                <label className={styles.topicLabel}>
                  <span>Topic</span>
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  >
                    <option value="">All topics</option>
                    {topics.map((entry) => (
                      <option value={entry} key={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(query || topic) && (
                <button
                  className={styles.resetButton}
                  onClick={resetFilters}
                  type="button"
                >
                  Reset
                </button>
              )}
            </div>
            <div className={styles.archiveRows}>
              {archive.map((post) => (
                <article className={styles.archiveRow} key={post.slug}>
                  <Link
                    aria-label={`Read ${post.title}`}
                    href={`/blog/${post.slug}`}
                  >
                    <PostImage post={post} className={styles.thumbnail} />
                  </Link>
                  <div>
                    {post.topics?.[0] && (
                      <span className={styles.topic}>{post.topics[0]}</span>
                    )}
                    <h3>
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    {post.summary && <p>{post.summary}</p>}
                    <time dateTime={post.publishedAt}>{post.createdAt}</time>
                  </div>
                  <Link
                    className={styles.rowLink}
                    aria-label={`Read ${post.title}`}
                    href={`/blog/${post.slug}`}
                  >
                    →
                  </Link>
                </article>
              ))}
              {featured && archive.length === 0 && (
                <p className={styles.noResults}>
                  No articles match those filters.{" "}
                  <button type="button" onClick={resetFilters}>
                    Reset filters
                  </button>
                </p>
              )}
            </div>
          </section>
          <aside className={styles.newsletter}>
            <ArticleNewsletter variant="library" />
          </aside>
        </div>
      </div>
    </Container>
  );
};

export default Blog;
