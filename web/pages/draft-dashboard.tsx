// pages/draft-dashboard.tsx

import { useState } from "react";
import type { GetServerSideProps } from "next";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
  const [isNoticeOpen, setIsNoticeOpen] = useState(true);
  const canDismissNotice = process.env.NODE_ENV === "development";

  if (canDismissNotice && !isNoticeOpen) {
    return <DraftDashboard />;
  }

  return (
    <main
      style={{
        alignItems: "center",
        background: "rgba(8, 15, 28, 0.9)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        position: "fixed",
        zIndex: 10000
      }}
    >
      <section
        aria-labelledby="draft-dashboard-maintenance-title"
        aria-modal="true"
        role="dialog"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.35)",
          color: "#111827",
          maxWidth: "560px",
          padding: "40px 32px",
          textAlign: "center",
          width: "100%"
        }}
      >
        <h1
          id="draft-dashboard-maintenance-title"
          style={{ fontSize: "2rem", margin: "0 0 16px" }}
        >
          Draft Dashboard
        </h1>
        <p style={{ fontSize: "1.125rem", lineHeight: 1.6, margin: 0 }}>
          Actively being updated for the 2026-2027 season. Check back soon
        </p>
        {canDismissNotice ? (
          <button
            onClick={() => setIsNoticeOpen(false)}
            style={{
              background: "#07aae2",
              border: 0,
              borderRadius: "8px",
              color: "#07111f",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 700,
              marginTop: "24px",
              padding: "12px 18px"
            }}
            type="button"
          >
            Continue to Draft Dashboard
          </button>
        ) : null}
      </section>
    </main>
  );
}
