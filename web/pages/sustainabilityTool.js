import React from "react";
import Layout from "../components/Layout";
import styles from "pages/sustainabilityTool.module.scss";

const sustainabilityTool = () => {
  return (
    <div>
      <div>
        <h1 className={styles.headersus}>Sustainability Tool</h1>
      </div>
      <div className={styles.susContainer}>
        <div className={styles.bioHeadshot}>div1</div>
        <div className={styles.susCells}>div2</div>
        <div className={styles.susCharts}>div3</div>
      </div>
    </div>
  );
};

export default sustainabilityTool;
