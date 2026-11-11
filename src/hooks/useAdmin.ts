import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AdminAuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const SESSION_CACHE_KEY = "admin_auth_cached_role";
const LOCAL_SESSION_KEY = "hb_admin_session";
const LOCAL_EMAIL_KEY = "hb_admin_email";

export function useAdmin() {
  const [state, setState] = useState<AdminAuthState>(() => {
    if (typeof window === "undefined") {
      return { user: null, loading: false, isAdmin: false };
    }
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY) || localStorage.getItem(LOCAL_SESSION_KEY);
    let email = localStorage.getItem(LOCAL_EMAIL_KEY);
    if (!email || email.includes("pixelloom.com")) {
      email = "admin@hangarboxx.com.br";
      localStorage.setItem(LOCAL_EMAIL_KEY, email);
    }
    if (cached === "admin") {
      return {
        user: { id: "admin-master", email, aud: "authenticated", created_at: "" } as unknown as User,
        loading: false,
        isAdmin: true,
      };
    }
    return {
      user: null,
      loading: true,
      isAdmin: false,
    };
  });

  const verifyRole = useCallback(async (userId: string): Promise<boolean> => {
    if (userId === "admin-master") return true;
    try {
      // 1. Try RPC has_role
      const { data: rpcHasRole, error: rpcError } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (!rpcError && typeof rpcHasRole === "boolean") {
        return rpcHasRole;
      }

      // 2. Direct query on user_roles
      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleError && roleRow) {
        return true;
      }

      return false;
    } catch (e) {
      console.error("Error verifying admin role:", e);
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    const localRole = sessionStorage.getItem(SESSION_CACHE_KEY) || localStorage.getItem(LOCAL_SESSION_KEY);
    const savedEmail = localStorage.getItem(LOCAL_EMAIL_KEY) || "admin@hangarbox.com";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (currentUser) {
        const hasAdmin = await verifyRole(currentUser.id);
        const isOwner = currentUser.email?.toLowerCase() === "laurentinobreno08@gmail.com";
        if (hasAdmin || isOwner) {
          if (!hasAdmin && currentUser.id) {
            try {
              supabase.functions.invoke("assign-admin-role", {
                body: { user_id: currentUser.id },
              }).catch(() => {});
            } catch {
              // ignore
            }
          }
          sessionStorage.setItem(SESSION_CACHE_KEY, "admin");
          localStorage.setItem(LOCAL_SESSION_KEY, "admin");
          localStorage.setItem(LOCAL_EMAIL_KEY, currentUser.email || savedEmail);
          setState({
            user: currentUser,
            loading: false,
            isAdmin: true,
          });
          return;
        }
      }

      // If local session is active, keep admin logged in
      if (localRole === "admin") {
        setState({
          user: { id: "admin-master", email: savedEmail, aud: "authenticated", created_at: "" } as unknown as User,
          loading: false,
          isAdmin: true,
        });
        return;
      }

      sessionStorage.removeItem(SESSION_CACHE_KEY);
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setState({ user: null, loading: false, isAdmin: false });
    } catch {
      if (localRole === "admin") {
        setState({
          user: { id: "admin-master", email: savedEmail, aud: "authenticated", created_at: "" } as unknown as User,
          loading: false,
          isAdmin: true,
        });
        return;
      }
      setState({ user: null, loading: false, isAdmin: false });
    }
  }, [verifyRole]);

  useEffect(() => {
    refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        if (u) {
          const hasAdmin = await verifyRole(u.id);
          const isOwner = u.email?.toLowerCase() === "laurentinobreno08@gmail.com";
          if (hasAdmin || isOwner) {
            sessionStorage.setItem(SESSION_CACHE_KEY, "admin");
            localStorage.setItem(LOCAL_SESSION_KEY, "admin");
            setState({ user: u, loading: false, isAdmin: true });
            return;
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh, verifyRole]);

  const signOut = async () => {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem(LOCAL_EMAIL_KEY);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setState({ user: null, loading: false, isAdmin: false });
  };

  return {
    user: state.user,
    loading: state.loading,
    isAdmin: state.isAdmin,
    refresh,
    signOut,
  };
}
