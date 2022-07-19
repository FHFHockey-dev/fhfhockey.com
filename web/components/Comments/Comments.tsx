import formatDate from "lib/formatDate";
import styles from "./Comments.module.scss";

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
        <span className={styles.userName}>{userName}</span> -{" "}
        <span>{formatDate(createdAt)}</span>
      </div>
    </li>
  );
}

type CommentsProps = {
  comments: CommentData[];
  loading: boolean;
};

function Comments({ comments, loading }: CommentsProps) {
  return (
    <section className={styles.comments}>
      <h2 className={styles.title}>Comments</h2>
      {loading ? (
        <p>loading...</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <Comment key={comment.id} {...comment} />
          ))}

          {comments.length === 0 ? <p>No comments</p> : ""}
        </ul>
      )}
    </section>
  );
}

export default Comments;
