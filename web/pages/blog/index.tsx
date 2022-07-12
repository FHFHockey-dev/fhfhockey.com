import { GetStaticProps, NextPage } from "next";
import Head from "next/head";

import { TextBanner } from "../../components/Banner/Banner";
import BlogPost from "components/BlogPost";
import styles from "styles/Blog.module.scss";

export type Post = {
  slug: string;
  title: string;
  createdAt: string;
  summary: string;
  /**
   * Preview image url.
   */
  imageUrl: string;
};

const getText = () => {
  return "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Debitis laboriosam minima rerum vel dolorum consequatur in excepturi nemo dolores. Fuga sunt nam sequi ratione itaque velit consectetur dignissimos! Doloremque, aperiam.";
};

export const getStaticProps: GetStaticProps = async () => {
  // TODO: fetch data from CMS
  const posts: Post[] = ["1", "2", "3", "4"].map((slug) => ({
    slug,
    title: `Title for post ${slug}`,
    summary: `I am the content, and my slug is:${slug}` + getText() + getText(),
    createdAt: new Date().toLocaleDateString(),
    imageUrl:
      "https://images.unsplash.com/photo-1545471977-94cac22e71ed?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80",
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
        <TextBanner text="The Blog" />
        <section className={styles.posts}>
          {posts.map((post) => (
            <BlogPost key={post.slug} {...post} />
          ))}
        </section>
      </main>
    </div>
  );
};

export default Blog;
