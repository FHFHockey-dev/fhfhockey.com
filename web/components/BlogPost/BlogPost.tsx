import React from "react";
import Image from "next/image";

import { Post } from "pages/blog";
import styles from "./BlogPost.module.scss";
import Link from "next/link";

function BlogPost({ title, slug, createdAt, summary, imageUrl }: Post) {
  return (
    <Link href={`/blog/${slug}`}>
      <article className={styles.post}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div>{createdAt}</div>
        </header>
        <div className={styles.body}>
          <div className={styles.summaryWrapper}>
            <p className={styles.summary}>{summary}</p>
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
        </div>
      </article>
    </Link>
  );
}

export default BlogPost;
