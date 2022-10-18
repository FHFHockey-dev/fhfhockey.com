import React from "react";

import { Button } from "@mui/material";
import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import ClientOnly from "components/ClientOnly";

import styles from "./Auth.module.scss";

import supabase from "lib/supabase";
import signInWithGitHub from "lib/supabase/signInWithGitHub";
import { useUser } from "contexts/AuthProviderContext";

function AuthPage() {
  const user = useUser();
  const username = user?.name;
  const isAdmin = user?.role === "admin";

  return (
    <Container className={styles.container}>
      <PageTitle>Authentication</PageTitle>
      <ClientOnly>
        {user ? (
          <div>
            Current user: {username} {isAdmin ? "Administrator" : ""}
          </div>
        ) : (
          <div>Please login</div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {!Boolean(username) ? (
            <Button variant="contained" onClick={signInWithGitHub}>
              Login
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              onClick={() => supabase.auth.signOut()}
            >
              Logout
            </Button>
          )}
        </div>
      </ClientOnly>
    </Container>
  );
}

export default AuthPage;
