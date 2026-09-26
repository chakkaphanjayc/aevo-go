import { accountsUrl, devTunnel } from "@/lib/env";
import { safeReturnTo } from "@/lib/deep-link";

const storageKey = "aevo_go_sso_flow";

export interface GoSsoFlow {
  state: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function beginGoSignIn(returnTo: string): Promise<void> {
  const flow: GoSsoFlow = {
    state: randomToken(32),
    verifier: randomToken(48),
    returnTo: safeReturnTo(returnTo),
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  sessionStorage.setItem(storageKey, JSON.stringify(flow));
  if (!accountsUrl && !devTunnel) throw new Error("Aevo Accounts is not configured for this deployment");
  const target = accountsUrl
    ? new URL("/v1/auth/start", accountsUrl)
    : new URL("/accounts/v1/auth/start", window.location.origin);
  target.searchParams.set("application", "GO");
  target.searchParams.set("redirect_uri", new URL("/auth/callback", window.location.origin).toString());
  target.searchParams.set("state", flow.state);
  target.searchParams.set("code_challenge", await codeChallenge(flow.verifier));
  window.location.assign(target.toString());
}

export function readGoSsoFlow(): GoSsoFlow | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<GoSsoFlow>;
    if (
      typeof candidate.state !== "string" ||
      typeof candidate.verifier !== "string" ||
      typeof candidate.returnTo !== "string" ||
      typeof candidate.expiresAt !== "number" ||
      candidate.expiresAt <= Date.now()
    ) return null;
    return candidate as GoSsoFlow;
  } catch {
    return null;
  }
}

export function clearGoSsoFlow(): void {
  sessionStorage.removeItem(storageKey);
}
