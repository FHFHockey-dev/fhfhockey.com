/////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\RecentPosts\RecentPosts.tsx

import classNames from "classnames";
import Link from "next/link";
import { PostPreviewData } from "pages/blog";

import styles from "./RecentPosts.module.scss";

function PostCard({ title, slug, summary, createdAt }: PostPreviewData) {
  return (
    (<Link href={`/blog/${slug}`} legacyBehavior>
      <article className={styles.postCard}>
        <header className={styles.header}>
          <h3>{title}</h3>
          <p>{createdAt}</p>
        </header>
        <p className={styles.summary}>{summary}</p>
      </article>
    </Link>)
  );
}

type RecentPostsProps = {
  posts: PostPreviewData[];
  className?: string;
};

function RecentPosts({ posts, className }: RecentPostsProps) {
  return (
    <ul className={classNames(styles.posts, className)}>
      {posts.map((post) => (
        <li key={post.slug}>
          <PostCard {...post} />
        </li>
      ))}
    </ul>
  );
}

export default RecentPosts;
