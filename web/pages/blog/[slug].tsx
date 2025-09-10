///////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\blog\[slug].tsx

import React, { useEffect, useRef, useState } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { PortableText } from "@portabletext/react";
import { urlFor } from "lib/sanity/sanity";
import { gql } from "@apollo/client";
import { NextSeo } from "next-seo";

import styles from "styles/Post.module.scss";
import { TextBanner } from "components/Banner/Banner";
import IconButton from "components/IconButton";
import Tooltip from "components/Tooltip";
import { Tooltip as MUI_Tooltip } from "@mui/material";
import CommentForm from "components/CommentForm";
import RecentPosts from "components/RecentPosts";
import Comments from "components/Comments";

import { PostPreviewData } from ".";
import client from "lib/apollo-client";
import scrollTop from "utils/scrollTop";
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
  /**
   * PortableText value
   */
  content: any;
  author: UserData;
};

const postsQuery = groq`*[_type == "post" && defined(slug.current)][].slug.current`;

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = await getClient().fetch(postsQuery);
  const paths = slugs.map((slug: string) => ({ params: { slug } }));
  return {
    paths,
    fallback: true
  };
};

const postQuery = groq`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    summary,
    mainImage,
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

const RECENT_POSTS_QUERY = gql`
  query GetRecentPosts($slug: String) {
    recentPosts: allPost(
      where: { slug: { current: { neq: $slug } } }
      limit: 3
      sort: { publishedAt: DESC }
    ) {
      slug {
        current
      }
      title
      summary
      publishedAt
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
  const [data, { data: recentPostsData }] = await Promise.all([
    getClient().fetch(postQuery, {
      slug
    }),
    client.query({
      query: RECENT_POSTS_QUERY,
      variables: {
        slug
      }
    })
  ]);

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
    summary,
    imageUrl: urlFor(mainImage).url(),
    content: body,
    createdAt: new Date(publishedAt).toLocaleDateString("en-US"),
    author: {
      name: author.name,
      bio: author.bio,
      image: urlFor(author.image).url()
    }
  };

  const recentPosts: PostPreviewData[] = recentPostsData.recentPosts.map(
    (post: any) => ({ ...post, slug: post.slug.current })
  );

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

  const fetchComments = () => {
    commentsRef.current?.refetch();
  };

  useEffect(() => {
    scrollTop();
  }, []);

  // If the page is not yet generated, this will be displayed
  // initially until getStaticProps() finishes running
  if (router.isFallback) {
    return <TextBanner text="Loading..." />;
  }

  const { slug, title, summary, imageUrl, content, createdAt, author } = post;
  return (
    <Container>
      <NextSeo
        title={`${title} | FHFH Blog`}
        description={summary}
        canonical={`${process.env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`}
        openGraph={{
          type: "article",
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`,
          images: [{ url: imageUrl, alt: title }],
          article: {
            publishedTime: new Date(createdAt).toISOString()
          }
        }}
      />
      <div className={styles.postPage}>
        <div className={styles.mainContent}>
          {/* Post Content */}
          <article className={styles.post}>
            <header className={styles.header}>
              <h1>{title}</h1>
              <div
                style={{
                  color: "white",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end"
                }}
              >
                <User user={author} />
                <div>{createdAt}</div>
              </div>
            </header>
            <div className={styles.portableText}>
              <PortableText
                value={content}
                components={{
                  types: {
                    image: ({ value }) => {
                      const alignment = value.alignment || "inline";
                      const alt = value.alt || "";
                      const src = urlFor(value).url();
                      const figureStyle: React.CSSProperties = {
                        margin:
                          alignment === "inline"
                            ? "1rem 0"
                            : alignment === "left"
                              ? "0.5rem 1rem 0.5rem 0"
                              : "0.5rem 0 0.5rem 1rem",
                        float:
                          alignment === "left" || alignment === "right"
                            ? (alignment as any)
                            : undefined,
                        maxWidth: alignment === "inline" ? "100%" : "45%"
                      };
                      const sizes =
                        alignment === "inline"
                          ? "(max-width: 480px) 100vw, (max-width: 1024px) 90vw, 900px"
                          : "(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 45vw";
                      return (
                        <figure className={styles.figure} style={figureStyle}>
                          <Image
                            alt={alt}
                            src={src}
                            width={700}
                            height={475}
                            sizes={sizes}
                          />
                          {value.caption ? (
                            <figcaption className={styles.figcaption}>
                              {value.caption}
                            </figcaption>
                          ) : null}
                        </figure>
                      );
                    }
                  }
                }}
              />
            </div>

            <div className={styles.actions}>
              <Tooltip onHoverText={!like ? "like" : "dislike"}>
                <IconButton
                  icon={like ? "heart-filled" : "heart-outlined"}
                  onClick={() => setLike((prev) => !prev)}
                />
              </Tooltip>
              <Tooltip onHoverText="Share" onClickText="Copied!">
                <IconButton
                  icon="share"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                />
              </Tooltip>
            </div>
          </article>
          {/* Comment Form*/}
          <CommentForm
            className={styles.commentForm}
            postId={post._id}
            fetchComments={fetchComments}
          />

          {/* Comments */}
          <Comments ref={commentsRef} slug={post.slug} />
        </div>
        <div className={styles.recentPosts}>
          <RecentPosts posts={recentPosts} />
        </div>
      </div>
    </Container>
  );
}

function User({ user }: { user: UserData }) {
  const { image, name, bio } = user;
  return (
    <MUI_Tooltip arrow title={<p style={{ whiteSpace: "pre-line" }}>{bio}</p>}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <div
          style={{
            borderRadius: "100%",
            overflow: "hidden",
            width: "32px",
            height: "32px",
            flexShrink: 0
          }}
        >
          <Image src={image} width={32} height={32} alt={name} />
        </div>
        <div>{name}</div>
      </div>
    </MUI_Tooltip>
  );
}

export default Post;
