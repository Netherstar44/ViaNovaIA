import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from '@capacitor/core';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const getBaseUrl = () => {
  // Allow explicit override via env var (e.g. for Capacitor APK pointing at a hosted backend).
  // In Replit (web), this is always empty so requests go to same-origin /api via Vite proxy.
  return (import.meta.env.VITE_API_BASE_URL as string) || "";
};

export const apiBase = getBaseUrl();

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  _retry = false
): Promise<Response> {
  const finalUrl = url.startsWith("http") ? url : `${getBaseUrl()}${url}`;
  const options: RequestInit = {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  };
  
  let res = await fetch(finalUrl, options);

  // Intercept 401 and try to refresh token (if not already retrying or logging in)
  if (res.status === 401 && !_retry && !url.includes("/api/auth/login") && !url.includes("/api/auth/refresh")) {
    try {
      const refreshRes = await fetch(`${getBaseUrl()}/api/auth/refresh`, { method: "POST", credentials: "include" });
      if (refreshRes.ok) {
        // Retry original request
        res = await fetch(finalUrl, options);
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
  }

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
    const options: RequestInit = { credentials: "include" };
    
    let res = await fetch(finalUrl, options);

    // Intercept 401 and try to refresh
    if (res.status === 401 && !url.includes("/api/auth/refresh")) {
      try {
        const refreshRes = await fetch(`${getBaseUrl()}/api/auth/refresh`, { method: "POST", credentials: "include" });
        if (refreshRes.ok) {
          res = await fetch(finalUrl, options);
        }
      } catch (e) {
        console.error("Query token refresh failed", e);
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
