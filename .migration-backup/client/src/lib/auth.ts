import { apiBase } from "@/lib/queryClient";
import { create } from 'zustand';

export type UserRole = 'hotel' | 'restaurant' | 'recreation' | 'taxi' | 'traveler' | 'translator' | 'admin';

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
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  loginDirect: (username: string, role: UserRole, name?: string, email?: string, roleChangedAt?: string | null) => void;
  register: (data: {
    username: string;
    password: string;
    name: string;
    email: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
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

export const useAuth = create<AuthState>((set, get) => {
  // Verify session with backend on init — sets loading=false when done
  setTimeout(async () => {
    const existingUser = localStorage.getItem('user');
    try {
      const res = await fetch(apiBase + '/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true, loading: false });
        localStorage.setItem('user', JSON.stringify(data.user));
        get().fetchRoles();
      } else {
        // Solo limpiar sesión si el usuario NO estaba autenticado ya por localStorage
        if (!existingUser) {
          set({ user: null, isAuthenticated: false, loading: false });
        } else {
          // Hay sesión en localStorage pero la cookie no está — trust localStorage
          set({ loading: false });
        }
      }
    } catch {
      // Error de red: no limpiar sesión, confiar en localStorage
      set({ loading: false });
    }
  }, 0);

  return {
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
    isAuthenticated: !!localStorage.getItem('user'),
    loading: true,

    login: async (username: string, password: string) => {
      set({ loading: true });
      try {
        const res = await fetch(apiBase + '/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          set({ loading: false });
          return { ok: false, message: data.message || 'Error al iniciar sesión' };
        }
        const user: User = {
          username: data.user.username,
          role: data.user.role || 'traveler',
          name: data.user.name,
          email: data.user.email,
          roleChangedAt: data.user.roleChangedAt,
        };
        if (data.token) localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true, loading: false });
        get().fetchRoles();
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    loginDirect: (username: string, role: UserRole, name?: string, email?: string, roleChangedAt?: string | null) => {
      const user: User = {
        username,
        role,
        name,
        email,
        roleChangedAt: roleChangedAt !== undefined ? roleChangedAt : undefined,
      };
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      get().fetchRoles();
    },

    register: async (data) => {
      set({ loading: true });
      try {
        const res = await fetch(apiBase + '/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
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
        if (result.token) localStorage.setItem('auth_token', result.token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true, loading: false });
        return { ok: true };
      } catch (err: any) {
        set({ loading: false });
        return { ok: false, message: err.message || 'Error de conexión' };
      }
    },

    logout: async () => {
      try {
        await fetch(apiBase + '/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // ignore
      }
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      set({ user: null, isAuthenticated: false });
      const { queryClient } = await import('./queryClient');
      queryClient.clear();
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
        const updated: User = { ...user, role: data.user.role, roleChangedAt: data.user.roleChangedAt };
        localStorage.setItem('user', JSON.stringify(updated));
        set({ user: updated });
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
