/** Attach native credentials only to the configured backend's API, never assets
 * or third-party URLs that happen to contain the text "/api". */
export function createNativeApiFetch(
  transport: typeof fetch,
  apiBase: string,
  getToken: () => Promise<string | null>,
): typeof fetch {
  return async (input, init) => {
    if (!apiBase) return transport(input, init);
    let request = input;
    let url = input instanceof Request ? input.url : String(input);
    if (/^\/api(?:\/|\?|#|$)/.test(url)) {
      url = `${apiBase.replace(/\/+$/, '')}${url}`;
      request = url;
    }
    let trusted = false;
    try {
      const target = new URL(url);
      const backend = new URL(apiBase);
      trusted = ['https:', 'http:'].includes(target.protocol)
        && target.origin === backend.origin
        && !target.username && !target.password
        && (target.pathname === '/api' || target.pathname.startsWith('/api/'));
    } catch { /* Relative non-API URLs and invalid URLs use the original transport. */ }
    if (!trusted) return transport(request, init);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    headers.set('X-Client-Platform', 'capacitor');
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return transport(request, { ...init, headers });
  };
}
