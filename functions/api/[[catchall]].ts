interface Env {
  BACKEND_URL?: string;
  PUBLIC_URL?: string;
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

    // Limpiar Domain en Set-Cookie para que la cookie pertenezca al dominio actual de Pages
    const setCookie = responseHeaders.get("Set-Cookie");
    if (setCookie) {
      const rewrittenCookie = setCookie.replace(/Domain=[^;]+;?/gi, "");
      responseHeaders.set("Set-Cookie", rewrittenCookie);
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
