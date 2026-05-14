import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { neon } from "@neondatabase/serverless";
import { DB_URL } from "./config";
import type { UserRole } from "../db/schema";

// Use raw SQL via neon() instead of Drizzle for auth — more reliable in RN
const sql = neon(DB_URL);

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
  register: (data: { username: string; password: string; name: string; email: string }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  changeRole: (role: UserRole) => Promise<{ ok: boolean; message?: string }>;
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
      console.log("[Auth] Attempting login for:", username);

      // Use pgcrypto's crypt() to verify password server-side in SQL
      const rows = await sql`
        SELECT id, username, name, email, role, role_changed_at
        FROM users
        WHERE username = ${username}
        AND password = crypt(${password}, password)
      `;

      console.log("[Auth] Login query returned:", rows.length, "rows");

      if (rows.length === 0) {
        set({ loading: false });
        return { ok: false, message: "Usuario o contraseña incorrectos" };
      }

      const row = rows[0];
      const user: AuthUser = {
        id: row.id,
        username: row.username,
        name: row.name,
        email: row.email,
        role: row.role || "traveler",
        roleChangedAt: row.role_changed_at,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      console.log("[Auth] Login successful for:", username);
      return { ok: true };
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      set({ loading: false });
      return { ok: false, message: err.message || "Error de conexión a la base de datos" };
    }
  },

  register: async (data) => {
    try {
      set({ loading: true });
      console.log("[Auth] Attempting registration for:", data.username);

      // Check if username exists
      const existingUser = await sql`SELECT id FROM users WHERE username = ${data.username}`;
      if (existingUser.length > 0) {
        set({ loading: false });
        return { ok: false, message: "El nombre de usuario ya está registrado" };
      }

      // Check if email exists
      const existingEmail = await sql`SELECT id FROM users WHERE email = ${data.email}`;
      if (existingEmail.length > 0) {
        set({ loading: false });
        return { ok: false, message: "El correo electrónico ya está registrado" };
      }

      // Create user with pgcrypto for password hashing (done server-side in SQL)
      const rows = await sql`
        INSERT INTO users (id, username, password, name, email, role, created_at)
        VALUES (
          gen_random_uuid(),
          ${data.username},
          crypt(${data.password}, gen_salt('bf', 12)),
          ${data.name},
          ${data.email},
          'traveler',
          NOW()
        )
        RETURNING id, username, name, email, role, role_changed_at
      `;

      console.log("[Auth] Registration returned:", rows.length, "rows");

      if (rows.length === 0) {
        set({ loading: false });
        return { ok: false, message: "Error al crear la cuenta" };
      }

      const row = rows[0];
      const user: AuthUser = {
        id: row.id,
        username: row.username,
        name: row.name,
        email: row.email,
        role: row.role || "traveler",
        roleChangedAt: row.role_changed_at,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      console.log("[Auth] Registration successful for:", data.username);
      return { ok: true };
    } catch (err: any) {
      console.error("[Auth] Register error:", err);
      set({ loading: false });
      return { ok: false, message: err.message || "Error de conexión" };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem("vianova_user");
    set({ user: null, isAuthenticated: false });
    console.log("[Auth] Logged out");
  },

  changeRole: async (role) => {
    const user = get().user;
    if (!user) return { ok: false, message: "No autenticado" };

    // Check cooldown
    if (user.roleChangedAt) {
      const diff = Date.now() - new Date(user.roleChangedAt).getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      if (days < 15) {
        const remaining = Math.ceil(15 - days);
        return { ok: false, message: `Espera ${remaining} día(s) más para cambiar tu rol.` };
      }
    }

    try {
      const rows = await sql`
        UPDATE users SET role = ${role}, role_changed_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, username, name, email, role, role_changed_at
      `;

      if (rows.length === 0) {
        return { ok: false, message: "Usuario no encontrado" };
      }

      const row = rows[0];
      const updated: AuthUser = {
        id: row.id,
        username: row.username,
        name: row.name,
        email: row.email,
        role: row.role,
        roleChangedAt: row.role_changed_at,
      };

      await AsyncStorage.setItem("vianova_user", JSON.stringify(updated));
      set({ user: updated });
      return { ok: true, message: "Rol actualizado" };
    } catch (err: any) {
      console.error("[Auth] Change role error:", err);
      return { ok: false, message: err.message };
    }
  },
}));
