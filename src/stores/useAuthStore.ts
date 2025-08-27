import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: any | null;
  roles: {
    is_qr_superadmin: number;
    is_qr_admin: number;
    is_qr_member: number;
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      roles: {
        is_qr_superadmin: 0,
        is_qr_admin: 0,
        is_qr_member: 0,
      },
      isAuthenticated: false,
      isLoading: true,
      login: async (email, password) => {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Login failed");
        }

        const user = result.data.user;
        set({
          user,
          roles: user?.user_metadata || {
            is_qr_superadmin: 0,
            is_qr_admin: 0,
            is_qr_member: 0,
          },
          isAuthenticated: true,
        });

        // Determine redirect path based on roles, then stash for after reload
        const meta = user?.user_metadata || {};
        let redirect = "/";
        if (meta.is_qr_superadmin === 1) redirect = "/superadmin-portal";
        else if (meta.is_qr_admin === 1) redirect = "/admin-portal";
        else if (meta.is_qr_member === 1) redirect = "/members-portal";
        try {
          localStorage.setItem("redirectAfterLogin", redirect);
        } catch {}

        // Force a hard refresh to sync client caches with server auth cookies
        window.location.reload();
      },
      logout: async () => {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Logout failed");
        }

        set({
          user: null,
          roles: { is_qr_superadmin: 0, is_qr_admin: 0, is_qr_member: 0 },
          isAuthenticated: false,
        });

        // Hard refresh for a clean logout and cache clear
        window.location.reload();
      },
    }),
    {
      name: "auth-store",
    }
  )
);
