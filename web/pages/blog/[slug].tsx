import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";

import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { PortableText } from "@portabletext/react";
import { urlFor } from "lib/sanity/sanity";

import styles from "styles/Post.module.scss";
import { TextBanner } from "components/Banner/Banner";
import IconButton from "components/IconButton";
import CommentForm from "components/CommentForm";

type PostData = {
  slug: string;
  title: string;
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

  const { title, publishedAt, body } = data;

  const post: PostData = {
    slug,
    title,
    content: body,
    createdAt: new Date(publishedAt).toLocaleDateString(),
  };
  return {
    props: post,
    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 10 seconds
    revalidate: 10, // In seconds
  };
};

function Post({ title, content, createdAt }: PostData) {
  const router = useRouter();

  // If the page is not yet generated, this will be displayed
  // initially until getStaticProps() finishes running
  if (router.isFallback) {
    return <TextBanner text="Loading..." />;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className={styles.postPage}>
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
                image: ({ value }) => <img alt="" src={urlFor(value).url()} />,
              },
            }}
          />

          <div className={styles.actions}>
            <IconButton icon="heart" />
            <IconButton icon="share" />
          </div>
        </article>

        {/* Comment Form*/}
        <CommentForm className={styles.commentForm} />

        {/* Comments */}
      </div>
    </>
  );
}

export default Post;
