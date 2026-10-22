import type { ReactNode } from "react";
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
 */
export default function AdminPageGate({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const robots = (
    <Head>
      <meta key="robots" name="robots" content="noindex,nofollow" />
    </Head>
  );

  if (isLoading) {
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
