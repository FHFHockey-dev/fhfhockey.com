import { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { urlFor } from "lib/sanity/sanity";

import { TextBanner } from "../../components/Banner/Banner";
import BlogPost from "components/BlogPost";
import styles from "styles/Blog.module.scss";

export type Post = {
  slug: string;
  title: string;
  /**
   * LocaleDateString.
   * '7/19/2022'
   */
  createdAt: string;
  summary: string;
  /**
   * Preview image url.
   */
  imageUrl: string;
};

const postsQuery = groq`
  *[_type == "post"] | order(publishedAt desc) {
    title,
    "slug": slug.current,
    mainImage,
    publishedAt,
    summary,
  }
`;

export const getStaticProps: GetStaticProps = async () => {
  // TODO: fetch data from CMS
  const posts = (await getClient().fetch(postsQuery)).map(
    // @ts-ignore
    ({ slug, title, summary, publishedAt, mainImage }) => ({
      slug,
      title,
      summary,
      createdAt: new Date(publishedAt).toLocaleDateString("en-US"),
      imageUrl: urlFor(mainImage).url(),
    })
  );

  return {
    props: {
      posts,
    },
    revalidate: 10,
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
