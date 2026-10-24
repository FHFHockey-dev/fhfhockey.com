import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "contexts/AuthProviderContext";
import { isSocialShareRole } from "lib/socialShare/access";

export default function SocialShareAccessGate({ children }: { children: ReactNode }) {
  const { user, isLoading, isRoleLoading } = useAuth();
  if (isLoading || isRoleLoading) return <p role="status">Checking share studio access…</p>;
  if (!user || !isSocialShareRole(user.role)) return <section aria-labelledby="share-access-title">
    <h1 id="share-access-title">Share studio</h1>
    <p role="alert">{user ? "Social editor access is required to use this studio." : "Sign in with your FHFH social editor account to continue."}</p>
    {!user && <Link href="/auth">Sign in</Link>}
  </section>;
  // An account switch must discard the previous user's edition and pending preview work.
  return <Fragment key={user.id}>{children}</Fragment>;
}
