import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

type PostData = {
  slug: string;
  title: string;
  createdAt: string;
  content: string;
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = ["1", "2", "3", "4"];
  const paths = posts.map((slug) => ({ params: { slug } }));
  return {
    paths,
    fallback: true,
  };
};

const getText = () => {
  return "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Debitis laboriosam minima rerum vel dolorum consequatur in excepturi nemo dolores. Fuga sunt nam sequi ratione itaque velit consectetur dignissimos! Doloremque, aperiam.";
};

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
  const posts = ["1", "2", "3", "4"];
  if (!posts.includes(slug))
    return {
      notFound: true,
    };

  const post: PostData = {
    slug,
    title: `Title for post ${slug}`,
    content: `I am the content, and my slug is:${slug}` + getText(),
    createdAt: new Date().toLocaleString(),
  };
  return {
    props: post,
    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 10 seconds
    revalidate: 10, // In seconds
  };
};

function Post({ title, slug, content, createdAt }: PostData) {
  const router = useRouter();

  // If the page is not yet generated, this will be displayed
  // initially until getStaticProps() finishes running
  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <article style={{ color: "white" }}>
      <h1>
        {slug}. {title}
      </h1>
      <sub>{createdAt}</sub>
      <div>{content}</div>
    </article>
  );
}

export default Post;
