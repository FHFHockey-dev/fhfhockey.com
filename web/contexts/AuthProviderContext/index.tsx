import { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  Session,
  User as SupabaseUser
} from "@supabase/supabase-js";

import supabase from "lib/supabase/client";
import { ensureUserRecords } from "lib/user-settings/ensureUserRecords";

type User = {
  id: string;
  email: string | null;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  emailConfirmedAt: string | null;
  isEmailVerified: boolean;
  providers: string[];
  role: "admin" | null;
} | null;

type AuthContextValue = {
  isLoading: boolean;
  user: User;
};

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  user: null
});

export const useAuth = () => useContext(AuthContext);
export const useUser = () => useContext(AuthContext).user;

type Props = {
  children: React.ReactNode;
};

export default function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ensuredUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    async function syncUserFromSession(session: Session | null) {
      if (!isMounted) return;

      if (!session) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(mapUser(session.user, { role: null }));
      setIsLoading(false);

      if (!ensuredUserIdsRef.current.has(session.user.id)) {
        ensuredUserIdsRef.current.add(session.user.id);
        void ensureUserRecords(session.user).catch(() => {
          ensuredUserIdsRef.current.delete(session.user.id);
        });
      }

      void supabase
        .from("users")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!isMounted || error) {
            return;
          }

          const resolvedRole = data?.role === "admin" ? "admin" : null;
          setUser((currentUser) => {
            if (!currentUser || currentUser.id !== session.user.id) {
              return currentUser;
            }

            if (currentUser.role === resolvedRole) {
              return currentUser;
            }

            return {
              ...currentUser,
              role: resolvedRole
            };
          });
        });
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => syncUserFromSession(data.session))
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await syncUserFromSession(session);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

function mapUser(user: SupabaseUser | null | undefined, extra?: any): User {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const displayName =
    metadata["preferred_username"] ||
    metadata["full_name"] ||
    metadata["name"] ||
    user.email ||
    user.id;
  const avatarUrl = metadata["avatar_url"] || metadata["picture"] || null;
  const providers = Array.isArray(appMetadata["providers"])
    ? appMetadata["providers"].filter((provider): provider is string =>
        typeof provider === "string"
      )
    : [];

  return {
    id: user.id,
    email: user.email ?? null,
    name: displayName,
    displayName,
    avatarUrl,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    isEmailVerified: Boolean(user.email_confirmed_at),
    providers,
    role: null,
    ...extra
  };
}
