import { apiBase } from "@/lib/queryClient";
import { create } from 'zustand';
import { authHeaders, clearAuthToken, setAuthToken } from './secureStorage';

export type UserRole = 'hotel' | 'restaurant' | 'recreation' | 'taxi' | 'traveler' | 'translator' | 'admin';

async function refreshRoleQueries() {
  const { queryClient } = await import('./queryClient');
  await queryClient.invalidateQueries();
}

export interface User {
  username: string;
  role: UserRole;
  name?: string;
  email?: string;
  roleChangedAt?: string | null;
  roles?: UserRole[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string; requires2FA?: boolean; username?: string }>;
  verify2FA: (username: string, code: string) => Promise<{ ok: boolean; message?: string }>;
  loginDirect: (username: string, role: UserRole, name?: string, email?: string, roleChangedAt?: string | null, token?: string | null) => void;
  register: (data: {
    username: string;
    password: string;
    name: string;
    email: string;
    acceptTerms: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  verifyResetToken: (token: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;
  changeRole: (role: UserRole) => Promise<{ ok: boolean; message?: string }>;
  switchActiveRole: (role: UserRole) => Promise<{ ok: boolean; message?: string }>;
  addRole: (role: UserRole, data?: Record<string, string>) => Promise<{ ok: boolean; message?: string }>;
  removeRole: (role: UserRole) => Promise<{ ok: boolean; message?: string }>;
  fetchRoles: () => Promise<UserRole[]>;
  refreshUser: () => void;
}

/**
 * Lee el usuario cacheado sin romper el arranque de la app si localStorage
 * contiene JSON corrupto o de una versión anterior. Un JSON inválido aquí
 * hacía fallar el store de zustand antes de montar React y dejaba el body vacío.
 */
function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.username !== 'string') {
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      return null;
    }
    return parsed as User;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => {
  // Verify session with backend on init — sets loading=false when done.
  // Timeout: a backend/DB stall must never leave the UI in a permanent blank
  // state; fall back to the cached session and stop the loading flag.
  setTimeout(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiBase + '/api/auth/me', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          set({ user: data.user, isAuthenticated: true, loading: false });
          localStorage.setItem('user', JSON.stringify(data.user));
          get().fetchRoles();
        } else {
          localStorage.removeItem('user');
          await clearAuthToken();
          set({ user: null, isAuthenticated: false, loading: false });
        }
      } else {
        localStorage.removeItem('user');
        await clearAuthToken();
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch {
      // Error de red/timeout: mantener caché local para no cerrar la sesión por una caída temporal
      set({ loading: false });
    } finally {
      clearTimeout(timeout);
    }
  }, 0);

  const storedUser = readStoredUser();

  return {
    user: storedUser,
    isAuthenticated: Boolean(storedUser),
    loading: true,

    login: async (username: string, password: string) => {
      set({ loading: true });
      try {
        const res = await fetch(apiBase + '/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          set({ loading: false });
          return { ok: false, message: data.message || 'Error al iniciar sesión' };
        }
        if (data.requires2FA) {
          set({ loading: false });
          return { ok: false, requires2FA: true, username: data.username, message: data.message };
        }
        const user: User = {
          username: data.user.username,
          role: data.user.role || 'traveler',
          name: data.user.name,
          email: data.user.email,
          roleChangedAt: data.user.roleChangedAt,
        };
        localStorage.setItem('user', JSON.stringify(user));
        await setAuthToken(data.token || null);
        set({ user, isAuthenticated: true, loading: false });
        const { queryClient } = await import('./queryClient');
        queryClient.clear();
        get().fetchRoles();
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    verify2FA: async (username: string, code: string) => {
      set({ loading: true });
      try {
        const res = await fetch(apiBase + '/api/auth/verify-2fa', {
          method: 'POST',
          credentials: 'include',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ username, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          set({ loading: false });
          return { ok: false, message: data.message || 'Código inválido' };
        }
        const user: User = {
          username: data.user.username,
          role: data.user.role || 'traveler',
          name: data.user.name,
          email: data.user.email,
          roleChangedAt: data.user.roleChangedAt,
        };
        localStorage.setItem('user', JSON.stringify(user));
        await setAuthToken(data.token || null);
        set({ user, isAuthenticated: true, loading: false });
        const { queryClient } = await import('./queryClient');
        queryClient.clear();
        get().fetchRoles();
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    loginDirect: (username: string, role: UserRole, name?: string, email?: string, roleChangedAt?: string | null, token?: string | null) => {
      const user: User = {
        username,
        role,
        name,
        email,
        roleChangedAt: roleChangedAt !== undefined ? roleChangedAt : undefined,
      };
      localStorage.setItem('user', JSON.stringify(user));
      void setAuthToken(token || null);
      set({ user, isAuthenticated: true, loading: false });
      get().fetchRoles();
    },

    register: async (data) => {
      set({ loading: true });
      try {
        const res = await fetch(apiBase + '/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) {
          set({ loading: false });
          return { ok: false, message: result.message || 'Error al registrarse' };
        }
        const user: User = {
          username: result.user.username,
          role: result.user.role || 'traveler',
          name: result.user.name,
          email: result.user.email,
          roles: ['traveler'],
        };
        localStorage.setItem('user', JSON.stringify(user));
        await setAuthToken(result.token || null);
        set({ user, isAuthenticated: true, loading: false });
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    logout: async () => {
      try {
        await fetch(apiBase + '/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: await authHeaders(),
        });
      } catch {
        // ignore
      }
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      await clearAuthToken();
      set({ user: null, isAuthenticated: false });
      const { queryClient } = await import('./queryClient');
      queryClient.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },

    forgotPassword: async (email: string) => {
      try {
        const res = await fetch(apiBase + '/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        return { ok: res.ok, message: data.message };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    verifyResetToken: async (token: string) => {
      try {
        const res = await fetch(apiBase + '/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        return { ok: data.valid === true, message: data.message };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    resetPassword: async (token: string, newPassword: string) => {
      try {
        const res = await fetch(apiBase + '/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        });
        const data = await res.json();
        return { ok: res.ok, message: data.message };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    changeRole: async (role: UserRole) => {
      const user = get().user;
      if (!user) return { ok: false, message: 'No autenticado' };
      try {
        const res = await fetch(apiBase + '/api/users/role', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, role }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, message: data.message };
        const updated: User = {
          ...user,
          role: data.user.role,
          roleChangedAt: data.user.roleChangedAt,
          roles: Array.from(new Set([...(user.roles || []), data.user.role as UserRole])),
        };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
        await refreshRoleQueries();
        return { ok: true, message: 'Rol actualizado exitosamente' };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    switchActiveRole: async (role: UserRole) => {
      const user = get().user;
      if (!user) return { ok: false, message: 'No autenticado' };
      try {
        const res = await fetch(apiBase + '/api/users/active-role', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, role }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, message: data.message };
        const updated: User = { ...user, role: data.user.role };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
        await refreshRoleQueries();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    addRole: async (role: UserRole, data?: Record<string, string>) => {
      const user = get().user;
      if (!user) return { ok: false, message: 'No autenticado' };
      try {
        const res = await fetch(`${apiBase}/api/users/${user.username}/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, ...data }),
        });
        const result = await res.json();
        if (!res.ok) return { ok: false, message: result.message };
        const updated: User = {
          ...user,
          role: result.user.role,
          roles: [...(user.roles || []).filter((r) => r !== role), role],
        };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
        await refreshRoleQueries();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    removeRole: async (role: UserRole) => {
      const user = get().user;
      if (!user) return { ok: false, message: 'No autenticado' };
      try {
        const res = await fetch(`${apiBase}/api/users/${user.username}/roles/${role}`, {
          method: 'DELETE',
        });
        const result = await res.json();
        if (!res.ok) return { ok: false, message: result.message };
        const updated: User = {
          ...user,
          role: result.user?.role || user.role,
          roles: (user.roles || []).filter((r) => r !== role),
        };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
        await refreshRoleQueries();
        return { ok: true };
      } catch (err: any) {
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    fetchRoles: async () => {
      const user = get().user;
      if (!user) return [];
      try {
        const res = await fetch(`${apiBase}/api/users/${user.username}/roles`);
        const data = await res.json();
        const roleNames: UserRole[] = (data.roles || []).map((r: any) => r.role);
        if (roleNames.length === 0) roleNames.push(user.role);
        const updated = { ...user, roles: roleNames };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
        return roleNames;
      } catch {
        return user.roles || [user.role];
      }
    },

    refreshUser: () => {
      const stored = localStorage.getItem('user');
      if (stored) {
        set({ user: JSON.parse(stored), isAuthenticated: true });
      }
    },
  };
});
