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

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setUser(null);
          return;
        }

        const extra: any = { role: null };

        if (event !== "SIGNED_OUT") {
          const { data } = await supabase
            .from("users")
            .select("role")
            .maybeSingle();
          extra.role = data?.role;
        }

        setUser(mapUser(session.user, extra));
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
