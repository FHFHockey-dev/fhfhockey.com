import { useQuery, gql, NetworkStatus } from "@apollo/client";
import Spinner from "components/Spinner";
import { forwardRef, useImperativeHandle } from "react";

import formatDate from "utils/formatDate";
import styles from "./Comments.module.scss";

const QUERY = gql`
  query GetComments($slug: String) {
    comments: allComment(
      where: { post: { slug: { current: { eq: $slug } } } }
      sort: { _createdAt: DESC }
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

function Comments({ slug }: { slug: string }, ref: any) {
  const { data, loading, refetch } = useQuery(QUERY, {
    variables: { slug },
    notifyOnNetworkStatusChange: true,
  });
  // allow other componet to refech the comments
  useImperativeHandle(ref, () => ({
    refetch: () => {
      refetch();
    },
  }));

  return (
    <section className={styles.comments}>
      <h2 className={styles.title} id="comments-heading">Comments</h2>
      <ul className={styles.list} aria-labelledby="comments-heading">
        {loading && <Spinner center />}
        {data?.comments.map((comment: CommentData) => (
          <Comment key={comment.id} {...comment} />
        ))}
        {!loading && data?.comments.length === 0 ? (
          <p className={styles.empty}>Be the first to comment</p>
        ) : null}
      </ul>
    </section>
  );
}

export default forwardRef(Comments);
