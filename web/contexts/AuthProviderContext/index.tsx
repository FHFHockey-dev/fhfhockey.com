import { createContext, useContext, useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import supabase from "lib/supabase";

type User = {
  id: string;
  name: string;
  role: "admin" | null;
} | null;

const AuthContext = createContext<User>(null);

export const useUser = () => useContext(AuthContext);

type Props = {
  children: React.ReactNode;
};

export default function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const extra = { role: isAdmin ? "admin" : null };
    // on page load, populate the user
    setUser(mapUser(supabase.auth.user(), extra));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(mapUser(session?.user, extra));
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [isAdmin]);

  // check if the user is admin
  useEffect(() => {
    (async () => {
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (data?.role === "admin") {
          setIsAdmin(true);
        }
      }
    })();
  }, [user]);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

function mapUser(user: SupabaseUser | null | undefined, extra?: any): User {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.user_metadata["preferred_username"],
    role: null,
    ...extra,
  };
}
