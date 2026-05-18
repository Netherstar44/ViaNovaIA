import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";

export type UserRole = "hotel" | "restaurant" | "recreation" | "taxi" | "traveler" | "translator" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  roleChangedAt: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  loginWithGoogleToken: (idToken: string) => Promise<{ ok: boolean; message?: string }>;
  register: (data: { username: string; password: string; name: string; email: string }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  changeRole: (role: UserRole) => Promise<{ ok: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  verifyResetToken: (token: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    try {
      const stored = await AsyncStorage.getItem("vianova_user");
      if (stored) {
        const u = JSON.parse(stored) as AuthUser;
        set({ user: u, isAuthenticated: true, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      console.error("[Auth] Init error:", e);
      set({ loading: false });
    }
  },

  login: async (username, password) => {
    try {
      set({ loading: true });

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ loading: false });
        return { ok: false, message: data.message || "Usuario o contraseña incorrectos" };
      }

      const user: AuthUser = {
        id: data.user.id || data.user.username,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role || "traveler",
        roleChangedAt: data.user.roleChangedAt,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      return { ok: true };
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      set({ loading: false });
      return { ok: false, message: "Error de conexión al servidor" };
    }
  },

  loginWithGoogleToken: async (idToken: string) => {
    try {
      set({ loading: true });

      // Send the Google ID token to our backend for verification
      const res = await fetch(`${API_URL}/api/auth/google/mobile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ loading: false });
        return { ok: false, message: data.message || "Error al autenticar con Google" };
      }

      const user: AuthUser = {
        id: data.user.id || data.user.username,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role || "traveler",
        roleChangedAt: data.user.roleChangedAt,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      return { ok: true };
    } catch (err: any) {
      console.error("[Auth] Google login error:", err);
      set({ loading: false });
      return { ok: false, message: "Error de conexión con Google" };
    }
  },

  register: async (data) => {
    try {
      set({ loading: true });

      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        set({ loading: false });
        return { ok: false, message: result.message || "Error al registrarse" };
      }

      const user: AuthUser = {
        id: result.user.id || result.user.username,
        username: result.user.username,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role || "traveler",
        roleChangedAt: result.user.roleChangedAt,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      return { ok: true };
    } catch (err: any) {
      console.error("[Auth] Register error:", err);
      set({ loading: false });
      return { ok: false, message: "Error de conexión al servidor" };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem("vianova_user");
    set({ user: null, isAuthenticated: false });
  },

  changeRole: async (role) => {
    const user = get().user;
    if (!user) return { ok: false, message: "No autenticado" };

    try {
      const res = await fetch(`${API_URL}/api/user/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, message: data.message || "Error al cambiar de rol" };
      }

      const updated: AuthUser = {
        ...user,
        role: data.user.role,
        roleChangedAt: data.user.roleChangedAt || new Date().toISOString(),
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(updated));
      set({ user: updated });
      return { ok: true, message: "Rol actualizado" };
    } catch (err: any) {
      return { ok: false, message: "Error de conexión" };
    }
  },

  forgotPassword: async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || "Error al enviar correo" };
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: "Error de conexión" };
    }
  },

  verifyResetToken: async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-reset-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || "Código inválido" };
      return { ok: true };
    } catch {
      return { ok: false, message: "Error de conexión" };
    }
  },

  resetPassword: async (token: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || "Error al restablecer" };
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: "Error de conexión" };
    }
  },
}));
