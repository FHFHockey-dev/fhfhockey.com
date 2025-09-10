///////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\BlogPost\BlogPost.tsx

import React from "react";

import { PostPreviewData } from "pages/blog";
import styles from "./BlogPost.module.scss";
import Link from "next/link";
import Image from "next/image";

function BlogPost({
  title,
  slug,
  createdAt,
  summary,
  imageUrl
}: PostPreviewData) {
  return (
    <Link href={`/blog/${slug}`} legacyBehavior>
      <article className={styles.post}>
        <div className={styles.textArea}>
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <div className={styles.createdAt}>{createdAt}</div>
          </header>
          <div className={styles.summaryWrapper}>
            <p className={styles.summary}>{summary}</p>
          </div>
        </div>

        <div className={styles.image}>
          <Image
            alt={title}
            src={imageUrl}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
            style={{ objectFit: "cover" }}
            priority={false}
          />
        </div>
      </article>
    </Link>
  );
}

export default BlogPost;
