import { FormEvent, useId } from "react";
import classNames from "classnames";
import styles from "./CommentForm.module.scss";

type CommentFormProps = {
  className?: string;
};

function CommentForm({ className, ...props }: CommentFormProps) {
  const displayName = useId();
  const comment = useId();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <form
      className={classNames(styles.form, className)}
      {...props}
      onSubmit={onSubmit}
    >
      <div className={styles.contentWrapper}>
        <label htmlFor={displayName} hidden>
          Display Name
        </label>
        <input
          className={styles.name}
          type="text"
          id={displayName}
          placeholder="Display Name..."
          title="display name"
        />
        <label htmlFor={comment} hidden>
          Comment
        </label>
        <textarea
          className={styles.comment}
          id={comment}
          placeholder="Enter your comment here"
          rows={5}
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.commentButton} type="submit">
          Comment
        </button>
      </div>
    </form>
  );
}

export default CommentForm;
