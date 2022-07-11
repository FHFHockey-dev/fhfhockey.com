import { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { TextBanner } from "../../components/Banner/Banner";

type Post = {
  id: string;
  title: string;
  createdAt: string;
  summary: string;
};

export const getStaticProps: GetStaticProps = async () => {
  // TODO: fetch data from CMS
  const posts: Post[] = ["1", "2", "3", "4"].map((id) => ({
    id,
    title: `Title for post ${id}`,
    summary: `I am the content, and my id is:${id}`,
    createdAt: new Date().toLocaleString(),
  }));

  return {
    props: {
      posts,
    },
  };
};

const Blog: NextPage<{ posts: Post[] }> = ({ posts }) => {
  return (
    <div>
      <Head>
        <title>FHFH | Blog</title>
      </Head>
      <main>
        <TextBanner text="FHFH Blog" />
        {posts.map((post) => (
          <div key={post.id} style={{ color: "whitesmoke" }}>
            <article>
              <Link href={`/blog/${post.id}`}>
                <h2>{post.title}</h2>
              </Link>
              <sub>{post.createdAt}</sub>
              <p>{post.summary}</p>
            </article>
            <hr />
          </div>
        ))}
      </main>
    </div>
  );
};

export default Blog;
