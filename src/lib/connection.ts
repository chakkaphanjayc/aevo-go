import { apiUrl } from "@/lib/env";

export type ProbePath = "/health" | "/ready";
export type GatewayStatus = "connected" | "unavailable";
export type GatewayConnectionStatus = "connected" | "degraded" | "unavailable";

export interface GatewayProbe {
  path: ProbePath;
  status: GatewayStatus;
  service?: string;
  latencyMs?: number;
  httpStatus?: number;
  error?: string;
}

export interface GatewayConnection {
  status: GatewayConnectionStatus;
  health: GatewayProbe;
  ready: GatewayProbe;
}

interface GatewayPayload {
  service?: unknown;
  status?: unknown;
}

function isGatewayPayload(value: unknown): value is GatewayPayload {
  return typeof value === "object" && value !== null;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Customer Gateway ไม่ตอบกลับภายใน 3 วินาที";
  }

  return "ไม่สามารถเชื่อมต่อ Customer Gateway ได้";
}

function timeoutSignal(milliseconds: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, cancel: () => window.clearTimeout(timer) };
}

async function probeGateway(path: ProbePath): Promise<GatewayProbe> {
  const startedAt = performance.now();
  const timeout = timeoutSignal(3_000);

  try {
    const response = await fetch(apiUrl(path), {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: timeout.signal
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        path,
        status: "unavailable",
        httpStatus: response.status,
        latencyMs,
        error: `Gateway ตอบกลับ HTTP ${response.status}`
      };
    }

    if (!isGatewayPayload(payload)) {
      return {
        path,
        status: "unavailable",
        httpStatus: response.status,
        latencyMs,
        error: "Gateway ส่ง response ที่ไม่ถูกต้อง"
      };
    }

    const expectedStatus = path === "/health" ? "healthy" : "ready";
    if (payload.status !== expectedStatus) {
      return {
        path,
        status: "unavailable",
        httpStatus: response.status,
        latencyMs,
        error: `Gateway ไม่ได้รายงานสถานะ ${expectedStatus}`
      };
    }

    return {
      path,
      status: "connected",
      httpStatus: response.status,
      latencyMs,
      ...(typeof payload.service === "string" ? { service: payload.service } : {})
    };
  } catch (error) {
    return { path, status: "unavailable", error: safeErrorMessage(error) };
  } finally {
    timeout.cancel();
  }
}

export async function checkGatewayConnection(): Promise<GatewayConnection> {
  const [health, ready] = await Promise.all([probeGateway("/health"), probeGateway("/ready")]);
  const status: GatewayConnectionStatus = health.status === "connected" && ready.status === "connected"
    ? "connected"
    : health.status === "connected"
      ? "degraded"
      : "unavailable";

  return { status, health, ready };
}
