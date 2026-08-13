// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
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
      </section>
    </main>
  );
}
