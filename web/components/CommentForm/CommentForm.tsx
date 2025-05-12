import { useId, useState } from "react";
import classNames from "classnames";
// @ts-ignore
import { useFormik, FormikHelpers } from "formik";
import * as Yup from "yup";

import styles from "./CommentForm.module.scss";
import Spinner from "components/Spinner";

type CommentFormProps = {
  className?: string;
  postId: string;
  /**
   * fetch the latest comments.
   */
  fetchComments: () => void;
};

type Values = {
  displayName: string;
  comment: string;
};

function CommentForm({
  className,
  postId,
  fetchComments,
  ...props
}: CommentFormProps) {
  const displayName = useId();
  const comment = useId();
  const [error, setError] = useState(null);

  const formik = useFormik({
    initialValues: { displayName: "", comment: "" },
    validationSchema: Yup.object({
      displayName: Yup.string()
        .min(4, "Display name must be at least 4 characters")
        .max(16, "Display name must be 16 characters or less")
        .required("A display name is required"),
      comment: Yup.string()
        .min(1, "Comment must be at least 1 characters")
        .max(1000, "Comment must be 1000 characters or less")
        .required("A comment is required")
    }),
    onSubmit: async (
      { displayName, comment }: Values,
      { setSubmitting, setFieldValue, setTouched }: FormikHelpers<Values>
    ) => {
      setSubmitting(true);
      setError(null);
      const response = await fetch("/api/createComment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: displayName, comment, postId })
      }).then((res) => res.json());

      // handle error
      if (response.error) {
        setError(response.message);
        return;
      }

      fetchComments();
      setSubmitting(false);
      setError(null);

      // reset comment
      setFieldValue("comment", "");
      setTouched({ comment: false });
    }
  });

  return (
    <form
      className={classNames(styles.form, className)}
      onSubmit={formik.handleSubmit}
      {...props}
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
          {...formik.getFieldProps("displayName")}
        />
        {formik.touched.displayName && formik.errors.displayName ? (
          <div className={styles.error}>{formik.errors.displayName}</div>
        ) : null}
        <label htmlFor={comment} hidden>
          Comment
        </label>
        <textarea
          className={styles.comment}
          id={comment}
          placeholder="Enter your comment here"
          rows={5}
          {...formik.getFieldProps("comment")}
        />
        {formik.touched.comment && formik.errors.comment ? (
          <div className={styles.error}>{formik.errors.comment}</div>
        ) : null}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        {formik.isSubmitting && <Spinner className={styles.spinner} />}
        <button
          className={styles.commentButton}
          type="submit"
          disabled={formik.isSubmitting}
        >
          Comment
        </button>
      </div>
    </form>
  );
}

export default CommentForm;
