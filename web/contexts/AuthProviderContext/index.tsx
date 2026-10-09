import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import type {
  Session,
  User as SupabaseUser
} from "@supabase/supabase-js";

import supabase from "lib/supabase/client";
import { resetSupabaseBrowserAuthState } from "lib/supabase/browser-auth";
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
  signOut: () => Promise<void>;
  refreshProfileAvatar: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  user: null,
  signOut: async () => undefined,
  refreshProfileAvatar: async () => undefined
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
  const avatarUserRef = useRef<{ id: string; metadataUrl: string | null } | null>(null);
  const avatarRequestRef = useRef(0);
  const sessionRevisionRef = useRef(0);

  const refreshProfileAvatar = useCallback(async (userId: string) => {
    const avatarUser = avatarUserRef.current;
    if (!avatarUser || avatarUser.id !== userId) return;
    const requestId = ++avatarRequestRef.current;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || avatarUserRef.current !== avatarUser || avatarRequestRef.current !== requestId) return;

      const avatarUrl = data?.avatar_url?.trim() || avatarUser.metadataUrl;
      setUser((currentUser) =>
        currentUser?.id === userId && currentUser.avatarUrl !== avatarUrl
          ? { ...currentUser, avatarUrl }
          : currentUser
      );
    } catch {
      // Keep the displayed avatar when the profile read is unavailable.
    }
  }, []);

  const signOut = useCallback(async () => {
    sessionRevisionRef.current++;
    avatarUserRef.current = null;
    avatarRequestRef.current++;
    // Fail closed in the rendered shell before touching a remote/expired session.
    setUser(null);
    setIsLoading(false);
    await resetSupabaseBrowserAuthState(supabase);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function syncUserFromSession(session: Session | null) {
      if (!isMounted) return;
      avatarRequestRef.current++;
      avatarUserRef.current = null;

      if (!session) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const mappedUser = mapUser(session.user, { role: null });
      avatarUserRef.current = { id: session.user.id, metadataUrl: mappedUser?.avatarUrl ?? null };
      setUser((currentUser) =>
        currentUser && mappedUser && currentUser.id === mappedUser.id
          ? { ...mappedUser, avatarUrl: currentUser.avatarUrl }
          : mappedUser
      );
      setIsLoading(false);
      void refreshProfileAvatar(session.user.id);

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

    const initialSessionRevision = sessionRevisionRef.current;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted || sessionRevisionRef.current !== initialSessionRevision) return;
        return syncUserFromSession(data.session);
      })
      .catch(() => {
        if (!isMounted || sessionRevisionRef.current !== initialSessionRevision) return;
        setUser(null);
        setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        sessionRevisionRef.current++;
        await syncUserFromSession(session);
      }
    );

    return () => {
      isMounted = false;
      avatarUserRef.current = null;
      authListener.subscription.unsubscribe();
    };
  }, [refreshProfileAvatar]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refreshProfileAvatar }}>
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
