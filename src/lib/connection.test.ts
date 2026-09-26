import { afterEach, describe, expect, it, vi } from "vitest";
import { checkGatewayConnection } from "@/lib/connection";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkGatewayConnection", () => {
  it("maps healthy and ready probes to connected without exposing the gateway URL", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), window.location.href).pathname;
      return Promise.resolve(new Response(JSON.stringify(
        path === "/health"
          ? { status: "healthy", service: "aevo-canonical-gateway", requestId: "private-request-id" }
          : { status: "ready", requestId: "private-request-id" }
      ), { status: 200, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkGatewayConnection();

    expect(result.status).toBe("connected");
    expect(result.health.service).toBe("aevo-canonical-gateway");
    expect(JSON.stringify(result)).not.toContain("private-request-id");
    expect(JSON.stringify(result)).not.toContain("localhost:4000");
  });

  it("reports degraded when health is available but readiness is not", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), window.location.href).pathname;
      return Promise.resolve(new Response(JSON.stringify(
        path === "/health" ? { status: "healthy" } : { error: { code: "DATABASE_UNAVAILABLE" } }
      ), { status: path === "/health" ? 200 : 503, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkGatewayConnection();

    expect(result.status).toBe("degraded");
    expect(result.health.status).toBe("connected");
    expect(result.ready.status).toBe("unavailable");
  });

  it("returns unavailable with a generic message when the gateway cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret network detail")));

    const result = await checkGatewayConnection();

    expect(result.status).toBe("unavailable");
    expect(result.health.error).toBe("ไม่สามารถเชื่อมต่อ Customer Gateway ได้");
    expect(result.ready.error).toBe("ไม่สามารถเชื่อมต่อ Customer Gateway ได้");
    expect(JSON.stringify(result)).not.toContain("secret network detail");
  });
});
