interface Env {
  BACKEND_URL?: string;
  PUBLIC_URL?: string;
}

function splitCookiesString(str: string): string[] {
  if (!str) return [];
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < str.length; i++) {
    if (str.slice(i, i + 8).toLowerCase() === "expires=") inExpires = true;
    if (inExpires && str[i] === ";") inExpires = false;
    if (!inExpires && str[i] === "," && str[i + 1] === " ") {
      cookies.push(str.slice(start, i).trim());
      start = i + 2;
    }
  }
  if (start < str.length) cookies.push(str.slice(start).trim());
  return cookies;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const backendBase = context.env.BACKEND_URL || "https://via-nova-ia.vercel.app";
  const targetUrl = new URL(url.pathname + url.search, backendBase);

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.set("Host", new URL(backendBase).host);
  requestHeaders.set("X-Forwarded-Host", url.host);
  requestHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  try {
    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: requestHeaders,
      body: context.request.body,
      redirect: "manual",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", url.origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    // Interceptar cualquier redirección (3xx), tanto URLs directas como parámetros codificados en OAuth
    const location = responseHeaders.get("Location");
    if (location) {
      const originDecoded = url.origin;
      const originEncoded = encodeURIComponent(url.origin);
      let rewritten = location
        .replaceAll("https://via-nova-ia.vercel.app", originDecoded)
        .replaceAll(encodeURIComponent("https://via-nova-ia.vercel.app"), originEncoded);
      responseHeaders.set("Location", rewritten);
    }

    // Preservar múltiples cookies individuales y eliminar Domain para que pertenezcan a Pages
    const rawCookies: string[] =
      typeof (response.headers as any).getSetCookie === "function"
        ? (response.headers as any).getSetCookie()
        : splitCookiesString(response.headers.get("Set-Cookie") || "");

    if (rawCookies.length > 0) {
      responseHeaders.delete("Set-Cookie");
      for (const cookie of rawCookies) {
        const rewrittenCookie = cookie.replace(/Domain=[^;]+;?/gi, "").trim();
        if (rewrittenCookie) {
          responseHeaders.append("Set-Cookie", rewrittenCookie);
        }
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Backend proxy error",
        message: error?.message || "No se pudo conectar con el servidor backend.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
