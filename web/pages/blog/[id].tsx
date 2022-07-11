import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

type PostData = {
  id: string;
  title: string;
  createdAt: string;
  content: string;
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = ["1", "2", "3", "4"];
  const paths = posts.map((id) => ({ params: { id } }));
  return {
    paths,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  // params contains the post `id`.
  // If the route is like /blog/1, then params.id is 1
  if (!params) {
    return {
      redirect: {
        destination: "/blog",
        permanent: false,
      },
    };
  }

  const id = params.id as string;
  const posts = ["1", "2", "3", "4"];
  if (!posts.includes(id))
    return {
      notFound: true,
    };

  const post: PostData = {
    id,
    title: `Title for post ${id}`,
    content: `I am the content, and my id is:${id}`,
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

function Post({ title, id, content, createdAt }: PostData) {
  const router = useRouter();

  // If the page is not yet generated, this will be displayed
  // initially until getStaticProps() finishes running
  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <article style={{ color: "white" }}>
      <h1>
        {id}. {title}
      </h1>
      <sub>{createdAt}</sub>
      <div>{content}</div>
    </article>
  );
}

export default Post;
