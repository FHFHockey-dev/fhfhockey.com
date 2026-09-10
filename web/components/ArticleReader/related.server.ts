import { groq } from "next-sanity";
import { getClient } from "lib/sanity/sanity.server";
import { urlFor } from "lib/sanity/sanity";
import { getSubstackPosts, SubstackPost } from "lib/substack";
import type { PostPreviewData } from "pages/blog";

export async function relatedArticles(currentSlug: string, topics: string[] = [], substackPosts?: SubstackPost[]): Promise<PostPreviewData[]> {
  const [sanity, substack] = await Promise.all([
    // Recommendations must not prevent an available full article from loading.
    getClient().fetch(groq`*[_type == "post" && defined(slug.current) && !(_id in path("drafts.**")) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())] { title, summary, mainImage, publishedAt, "slug": slug.current, "topics": categories[]->title }`).catch(() => []),
    substackPosts ? Promise.resolve(substackPosts) : getSubstackPosts().catch(() => [])
  ]);
  const candidates: PostPreviewData[] = [
    ...sanity.map((post: any) => ({ slug: post.slug, title: post.title, summary: post.summary || "", topics: (post.topics || []).filter(Boolean), publishedAt: post.publishedAt, createdAt: "", imageUrl: post.mainImage?.asset ? urlFor(post.mainImage).url() : "" })),
    ...substack.map((post) => ({ slug: `substack/${post.slug}`, title: post.title, summary: post.summary, publishedAt: post.publishedAt, createdAt: "", imageUrl: post.imageUrl, unoptimizedImage: true }))
  ];
  const overlap = (post: PostPreviewData) => post.topics?.filter((topic) => topics.includes(topic)).length || 0;
  return candidates.filter((post) => post.slug !== currentSlug).sort((a, b) => overlap(b) - overlap(a) || Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || "") || a.slug.localeCompare(b.slug)).slice(0, 2);
}
