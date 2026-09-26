import { customerSessionSchema, type CustomerSession } from "@/contracts/auth";
import { ApiClientError, requestJson } from "@/lib/api-client";

export async function getCustomerSession(): Promise<CustomerSession | null> {
  try {
    const payload = await requestJson<unknown>("/api/auth/go/me");
    return customerSessionSchema.parse(payload);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw error;
  }
}

export async function refreshCustomerSession(): Promise<void> {
  await requestJson<unknown>("/api/auth/go/refresh", { method: "POST" });
}

export async function logoutCustomer(): Promise<void> {
  await requestJson<unknown>("/api/auth/go/logout", { method: "POST" });
}

export async function completeCustomerSignIn(input: { code: string; state: string; codeVerifier: string }): Promise<void> {
  await requestJson<unknown>("/api/auth/go/handoff/complete", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
