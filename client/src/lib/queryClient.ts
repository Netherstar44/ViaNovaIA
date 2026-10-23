import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from '@capacitor/core';
import { authHeaders } from './secureStorage';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Web deployments (including Cloudflare Workers) are always same-origin. Only
// native/Capacitor builds need an absolute backend URL, and that URL can be
// supplied at build time with VITE_NATIVE_API_BASE.
const FALLBACK_NATIVE_API_BASE = "https://via-nova-ia.vercel.app";
const configuredNativeApiBase = String(import.meta.env.VITE_NATIVE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

export const getBaseUrl = () => {
  const isApp = (typeof window !== 'undefined' && Capacitor.isNativePlatform()) ||
                (typeof navigator !== 'undefined' && navigator.userAgent.includes('wv'));
  if (isApp) {
    return configuredNativeApiBase || FALLBACK_NATIVE_API_BASE;
  }
  return "";
};

export const apiBase = getBaseUrl();

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const finalUrl = url.startsWith("http") ? url : `${getBaseUrl()}${url}`;
  const res = await fetch(finalUrl, {
    method,
    headers: await authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const finalUrl = url.startsWith("http") ? url : `${getBaseUrl()}${url}`;
    const res = await fetch(finalUrl, {
      credentials: "include",
      headers: await authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      // Los datos de servidor no son infinitamente frescos: 30s evita mostrar
      // reservas, stock o notificaciones obsoletos tras volver a la pestaña.
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
