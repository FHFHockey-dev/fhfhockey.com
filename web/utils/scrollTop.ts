import styles from "components/Layout/Layout.module.scss";

export default function scrollTop() {
  // .content class contains the main content of each page
  document
    .getElementsByClassName(styles.content)[0]
    ?.scrollTo({ top: 0, left: 0 });
}
