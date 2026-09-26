interface Env {
  ASSETS: Fetcher;
  AEVO_API_ORIGIN?: string;
  AEVO_APP_CODE?: string;
  AEVO_ENVIRONMENT?: string;
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders
  });
}

function originUrl(origin: string, requestUrl: URL): URL {
  const target = new URL(origin);
  target.pathname = requestUrl.pathname;
  target.search = requestUrl.search;
  return target;
}

async function proxyToCoreApi(request: Request, env: Env): Promise<Response> {
  const origin = env.AEVO_API_ORIGIN?.trim();
  if (!origin) {
    return json({
      error: {
        code: "CORE_API_NOT_CONFIGURED",
        message: "Customer Gateway is not configured for this environment."
      }
    }, 503);
  }

  let target: URL;
  try {
    target = originUrl(origin, new URL(request.url));
  } catch {
    return json({
      error: {
        code: "CORE_API_ORIGIN_INVALID",
        message: "Customer Gateway configuration is invalid."
      }
    }, 503);
  }

  const headers = new Headers(request.headers);
  headers.set("x-aevo-app", env.AEVO_APP_CODE ?? "GO");
  headers.set("x-aevo-environment", env.AEVO_ENVIRONMENT ?? "unknown");
  headers.set("x-aevo-edge-request-id", crypto.randomUUID());
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual"
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return fetch(target, init);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ status: "healthy", service: "aevo-go-edge", environment: env.AEVO_ENVIRONMENT ?? "unknown" });
    }

    if (url.pathname === "/ready") {
      if (!env.AEVO_API_ORIGIN?.trim()) {
        return json({ status: "not_configured", service: "aevo-go-edge" }, 503);
      }
      const response = await proxyToCoreApi(new Request(new URL("/ready", request.url), request), env);
      return response;
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return proxyToCoreApi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
