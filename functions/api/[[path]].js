const UPSTREAM_ORIGIN = "https://uzbek-resale-orders.amegakid.workers.dev";

export async function onRequest(context) {
  const { request, params } = context;

  const incomingUrl = new URL(request.url);
  const catchall = params.path;
  const pathParts = Array.isArray(catchall)
    ? catchall
    : (catchall ? [catchall] : []);

  const upstreamUrl = new URL(
    "/" + pathParts.map(encodeURIComponent).join("/"),
    UPSTREAM_ORIGIN
  );
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);

  // Let Cloudflare set the correct upstream Host automatically.
  headers.delete("host");

  const method = request.method.toUpperCase();

  const init = {
    method,
    headers,
    redirect: "manual"
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), init);
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: "UPSTREAM_UNREACHABLE",
      message: String(error?.message || error)
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const responseHeaders = new Headers(upstreamResponse.headers);

  // Browser talks to /api on the SAME Pages origin, so upstream CORS
  // headers are unnecessary and can conflict with the Pages origin.
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-methods");
  responseHeaders.delete("access-control-allow-headers");
  responseHeaders.delete("access-control-allow-credentials");
  responseHeaders.delete("access-control-max-age");

  responseHeaders.set("X-ReSale-Proxy", "cloudflare-pages");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}
