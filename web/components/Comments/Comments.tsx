import { useQuery, gql } from "@apollo/client";

import formatDate from "utils/formatDate";
import styles from "./Comments.module.scss";

const QUERY = gql`
  query GetComments($slug: String) {
    comments: allComment(
      where: { post: { slug: { current: { eq: $slug } } } }
    ) {
      id: _id
      userName: name
      content: comment
      createdAt: _updatedAt
    }
  }
`;

type CommentData = {
  id: string;
  userName: string;
  content: string;
  /**
   * ISO string of a date.
   * e.g., '2022-07-19T01:43:57.354Z'
   */
  createdAt: string;
};

function Comment({ userName, content, createdAt }: CommentData) {
  return (
    <li className={styles.comment}>
      <div className={styles.content}>{content}</div>
      <div className={styles.footer}>
        <span className={styles.userName}>{userName}</span>
        <span style={{ margin: "0 0.3rem" }}>-</span>
        <span>{formatDate(createdAt)}</span>
      </div>
    </li>
  );
}

function Comments({ slug }: { slug: string }) {
  const { data, loading } = useQuery(QUERY, {
    variables: { slug },
  });

  if (loading) return <p>loading...</p>;

  const comments: CommentData[] = data.comments;

  return (
    <section className={styles.comments}>
      <h2 className={styles.title}>Comments</h2>
      <ul className={styles.list}>
        {comments.map((comment) => (
          <Comment key={comment.id} {...comment} />
        ))}

        {comments.length === 0 ? <p>No comments</p> : ""}
      </ul>
    </section>
  );
}

export default Comments;
