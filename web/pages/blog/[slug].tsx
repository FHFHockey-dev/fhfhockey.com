import React, { useEffect, useRef } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";

import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { PortableText } from "@portabletext/react";
import { urlFor } from "lib/sanity/sanity";

import styles from "styles/Post.module.scss";
import { TextBanner } from "components/Banner/Banner";
import IconButton from "components/IconButton";
import CommentForm from "components/CommentForm";

import RecentPosts from "components/RecentPosts";
import { PostPreviewData } from ".";
import Comments from "components/Comments";
// const Comments = dynamic(() => import("components/Comments"), { ssr: false });

type PostDetailsData = {
  _id: string;
  slug: string;
  title: string;
  /**
   * LocaleDateString
   * e.g., '7/19/2022'
   */
  createdAt: string;
  /**
   * PortableText value
   */
  content: any;
};

const postsQuery = groq`*[_type == "post" && defined(slug.current)][].slug.current`;

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = await getClient().fetch(postsQuery);
  const paths = slugs.map((slug: string) => ({ params: { slug } }));
  return {
    paths,
    fallback: true,
  };
};

const postQuery = groq`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    publishedAt,
    body,
  }
`;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  // params contains the post `slug`.
  // If the route is like /blog/1, then params.slug is 1
  if (!params) {
    return {
      redirect: {
        destination: "/blog",
        permanent: false,
      },
    };
  }

  const slug = params.slug as string;
  const data = await getClient().fetch(postQuery, {
    slug,
  });

  if (!data) {
    return {
      notFound: true,
    };
  }

  const { _id, title, publishedAt, body } = data;

  const post: PostDetailsData = {
    _id,
    slug,
    title,
    content: body,
    createdAt: new Date(publishedAt).toLocaleDateString("en-US"),
  };

  const recentPosts: PostPreviewData[] = [
    {
      title: "Blog One",
      createdAt: new Date(2001, 10, 3).toLocaleDateString("en-US"),
      slug: "blog-one",
      summary: "I am the summary of the first post",
      imageUrl: "",
    },

    {
      title: "Blog two",
      createdAt: new Date(2001, 10, 3).toLocaleDateString("en-US"),
      slug: "blog-one",
      summary: "I am the summary of the first post",
      imageUrl: "",
    },

    {
      title: "Blog Three",
      createdAt: new Date(2001, 10, 3).toLocaleDateString("en-US"),
      slug: "blog-one",
      summary: "I am the summary of the first post",
      imageUrl: "",
    },
  ];

  return {
    props: { post, recentPosts },
    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 10 seconds
    revalidate: 10, // In seconds
  };
};

type PostPageProps = {
  post: PostDetailsData;
  recentPosts: PostPreviewData[];
};

function Post({ post, recentPosts }: PostPageProps) {
  const router = useRouter();
  const commentsRef = useRef<any>(null);

  const fetchComments = () => {
    commentsRef.current?.refetch();
  };

  // If the page is not yet generated, this will be displayed
  // initially until getStaticProps() finishes running
  if (router.isFallback) {
    return <TextBanner text="Loading..." />;
  }

  const { title, content, createdAt } = post;

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className={styles.postPage}>
        <div className={styles.mainContent}>
          {/* Post Content */}
          <article className={styles.post}>
            <header className={styles.header}>
              <h1>{title}</h1>
              <sub>{createdAt}</sub>
            </header>
            <PortableText
              value={content}
              components={{
                types: {
                  image: ({ value }) => (
                    // eslint-disable-next-line
                    <img alt="" src={urlFor(value).url()} />
                  ),
                },
              }}
            />

            <div className={styles.actions}>
              <IconButton icon="heart" />
              <IconButton icon="share" />
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
    </>
  );
}

export default Post;
