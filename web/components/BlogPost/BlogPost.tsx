///////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\BlogPost\BlogPost.tsx

import React from "react";
import Image from "next/legacy/image";

import { PostPreviewData } from "pages/blog";
import styles from "./BlogPost.module.scss";
import Link from "next/link";

function BlogPost({
  title,
  slug,
  createdAt,
  summary,
  imageUrl,
}: PostPreviewData) {
  return (
    (<Link href={`/blog/${slug}`} legacyBehavior>
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
            width="100%"
            height="100%"
            layout="responsive"
            objectFit="cover"
          />
        </div>
      </article>
    </Link>)
  );
}

export default BlogPost;
