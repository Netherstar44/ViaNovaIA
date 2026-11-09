interface Env {
  BACKEND_URL?: string;
  PUBLIC_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // Reenviar al backend de producción en Vercel si no se especifica otro
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
    // Eliminar o ajustar CSP si entra en conflicto
    responseHeaders.set("Access-Control-Allow-Origin", url.origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

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
