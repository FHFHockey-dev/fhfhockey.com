///////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\blog\[slug].tsx

import React, { useRef, useState } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { PortableText } from "@portabletext/react";
import { urlFor } from "lib/sanity/sanity";
import { NextSeo } from "next-seo";

import styles from "styles/Post.module.scss";
import { TextBanner } from "components/Banner/Banner";
import CommentForm from "components/CommentForm";
import Comments from "components/Comments";

import type { PostPreviewData } from ".";
import { relatedArticles } from "components/ArticleReader/related.server";
import ArticleReader from "components/ArticleReader/ArticleReader";
import { portableHeadings, headingTone } from "components/ArticleReader/headings";
import Container from "components/Layout/Container";

import Image from "next/image";

type UserData = {
  name: string;
  image: string;
  bio: string;
};

type PostDetailsData = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  /**
   * Preview image url.
   */
  imageUrl: string;
  /**
   * LocaleDateString
   * e.g., '7/19/2022'
   */
  createdAt: string;
  publishedAt: string;
  topics: string[];
  imageAlt: string;
  /**
   * PortableText value
   */
  content: any;
  author: UserData;
};

const postsQuery = groq`*[_type == "post" && defined(slug.current) && !(_id in path("drafts.**")) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())][].slug.current`;

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = await getClient().fetch(postsQuery);
  const paths = slugs.map((slug: string) => ({ params: { slug } }));
  return {
    paths,
    fallback: true
  };
};

const postQuery = groq`
  *[_type == "post" && slug.current == $slug && !(_id in path("drafts.**")) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())][0] {
    _id,
    title,
    summary,
    mainImage,
    "topics": categories[]->title,
    "slug": slug.current,
    publishedAt,
    body,
    author -> {
      _id,
      name,
      bio,
      image
    }
  }
`;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  // params contains the post `slug`.
  // If the route is like /blog/1, then params.slug is 1
  if (!params) {
    return {
      redirect: {
        destination: "/blog",
        permanent: false
      }
    };
  }

  const slug = params.slug as string;
  const data = await getClient().fetch(postQuery, { slug });

  if (!data) {
    return {
      notFound: true
    };
  }

  const { _id, title, summary, mainImage, publishedAt, body, author } = data;

  const post: PostDetailsData = {
    _id,
    slug,
    title,
    summary: summary || "",
    imageUrl: mainImage?.asset ? urlFor(mainImage).url() : "",
    imageAlt: mainImage?.alt || "",
    topics: (data.topics || []).filter(Boolean),
    publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : "",
    content: body || [],
    createdAt: publishedAt ? new Date(publishedAt).toLocaleDateString("en-US", { timeZone: "UTC" }) : "",
    author: {
      name: author?.name || "",
      bio: author?.bio || "",
      image: author?.image?.asset ? urlFor(author.image).url() : ""
    }
  };

  const recentPosts = await relatedArticles(slug, post.topics);

  return {
    props: { post, recentPosts },
    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 10 seconds
    revalidate: 10 // In seconds
  };
};

type PostPageProps = {
  post: PostDetailsData;
  recentPosts: PostPreviewData[];
};

function Post({ post, recentPosts }: PostPageProps) {
  const router = useRouter();
  const [like, setLike] = useState(false);
  const commentsRef = useRef<any>(null);
  if (router.isFallback) return <TextBanner text="Loading article…" />;
  const { slug, title, summary, imageUrl, content, publishedAt, author, topics } = post;
  const headings = portableHeadings(content);
  const heading = ({ value, children }: any) => {
    const entry = headings.find((item) => item.key === value._key);
    const Tag = `h${entry?.level || 2}` as "h2" | "h3" | "h4";
    return <Tag id={entry?.id} tabIndex={-1} data-tone={headingTone(entry?.text || "")}>{children}</Tag>;
  };
  return <Container contentVariant="full" className={styles.readerCanvas}>
    <NextSeo
      title={`${title} | FHFH Blog`}
      description={summary}
      canonical={`${process.env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`}
      openGraph={{ type: "article", url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`, images: imageUrl ? [{ url: imageUrl, alt: title }] : [], article: { publishedTime: publishedAt || undefined } }}
    />
    <ArticleReader title={title} summary={summary} imageUrl={imageUrl} imageAlt={post.imageAlt} author={author.name} authorImage={author.image} publishedAt={publishedAt} topics={topics} headings={headings} related={recentPosts} interactions={<>
      <button className={styles.likeButton} type="button" aria-pressed={like} onClick={() => setLike((previous) => !previous)}>{like ? "♥ Liked" : "♡ Like article"}</button>
      <CommentForm className={styles.commentForm} postId={post._id} fetchComments={() => commentsRef.current?.refetch()} />
      <Comments ref={commentsRef} slug={post.slug} />
    </>}>
      <PortableText value={content} components={{
        block: { h1: heading, h2: heading, h3: heading, h4: heading },
        types: { image: ({ value }) => <figure className={styles.figure} data-alignment={value.alignment || "inline"}>
          <Image alt={value.alt || ""} src={urlFor(value).url()} width={1200} height={800} sizes="(max-width: 1023px) 100vw, 740px" />
          {value.caption && <figcaption>{value.caption}</figcaption>}
        </figure> }
      }} />
    </ArticleReader>
  </Container>;
}

export default Post;
