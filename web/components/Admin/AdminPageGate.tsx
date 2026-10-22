import { useEffect, useState, type ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";
import { Button, Typography } from "@mui/material";

import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import { useAuth } from "contexts/AuthProviderContext";

export const ADMIN_PROHIBITED_MESSAGE =
  "Authorization prohibited: administrator access required";

/**
 * Renders `children` only for a signed-in admin. Pages put their admin UI
 * (and every hook that fetches admin data) in a child component, so nothing
 * mounts or fetches before this check passes. The API routes enforce admin
 * on their own; this keeps the pages themselves closed.
 *
 * `allowReviewToken`: a page opened from an emailed review link
 * (`?reviewToken=…`) renders without admin sign-in; its API validates the token.
 */
export default function AdminPageGate({
  children,
  allowReviewToken = false
}: {
  children: ReactNode;
  allowReviewToken?: boolean;
}) {
  const { isLoading, isRoleLoading, user } = useAuth();
  // Read after mount (the URL isn't available during server rendering).
  const [reviewLink, setReviewLink] = useState<"pending" | "present" | "absent">(
    allowReviewToken ? "pending" : "absent"
  );
  useEffect(() => {
    if (!allowReviewToken) return;
    const token = new URLSearchParams(window.location.search).get("reviewToken");
    setReviewLink(token && token.trim() ? "present" : "absent");
  }, [allowReviewToken]);
  const robots = (
    <Head>
      <meta key="robots" name="robots" content="noindex,nofollow" />
    </Head>
  );

  if (reviewLink === "present") {
    return (
      <>
        {robots}
        {children}
      </>
    );
  }

  // Wait for the role only while it is unknown; a known admin stays in.
  if (isLoading || reviewLink === "pending" || (user && user.role !== "admin" && isRoleLoading)) {
    return (
      <Container>
        {robots}
        <TextBanner text="Checking administrator access…" />
      </Container>
    );
  }

  if (user?.role !== "admin") {
    return (
      <Container>
        {robots}
        <TextBanner text={ADMIN_PROHIBITED_MESSAGE} />
        <Typography role="alert" sx={{ mb: 2 }}>
          {user
            ? "This account is not an administrator. Sign in with an administrator account to continue."
            : "You are signed out. Sign in with an administrator account to continue."}
        </Typography>
        {!user && (
          <Link href="/auth" passHref legacyBehavior>
            <Button component="a" sx={{ mr: 1 }}>
              Sign in
            </Button>
          </Link>
        )}
        <Link href="/" passHref legacyBehavior>
          <Button component="a">Return home</Button>
        </Link>
      </Container>
    );
  }

  return (
    <>
      {robots}
      {children}
    </>
  );
}
