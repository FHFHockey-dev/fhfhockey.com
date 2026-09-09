import { GetStaticPaths, GetStaticProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import { getSubstackPosts, SubstackPost } from "lib/substack";
import styles from "styles/Post.module.scss";
import ArticleReader from "components/ArticleReader/ArticleReader";
import { prepareArticleHtml } from "components/ArticleReader/html.server";
import type { ArticleHeading } from "components/ArticleReader/headings";
import type { PostPreviewData } from "pages/blog";
import { relatedArticles } from "components/ArticleReader/related.server";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking"
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const posts = await getSubstackPosts();
  const post = posts.find((entry) => entry.slug === params?.slug);
  if (!post) return { notFound: true, revalidate: 300 };
  const prepared = prepareArticleHtml(post.content);
  const related = await relatedArticles(`substack/${post.slug}`, [], posts);
  return { props: { post: { ...post, content: prepared.content }, headings: prepared.headings, related }, revalidate: 300 };
};

export default function SubstackArticle({ post, headings, related }: { post: SubstackPost; headings: ArticleHeading[]; related: PostPreviewData[] }) {
  return (
    <Container contentVariant="full" className={styles.readerCanvas}>
      <NextSeo
        title={`${post.title} | FHFH Blog`}
        description={post.summary}
        canonical={post.sourceUrl}
        openGraph={{
          type: "article",
          images: post.imageUrl.startsWith("https://") ? [{ url: post.imageUrl, alt: post.title }] : [],
          article: { publishedTime: post.publishedAt }
        }}
      />
      <ArticleReader title={post.title} summary={post.summary} author={post.author} publishedAt={post.publishedAt} imageUrl={post.imageUrl} imageFit="cover" sourceUrl={post.sourceUrl} unoptimizedImage headings={headings} related={related}>
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </ArticleReader>
    </Container>
  );
}
