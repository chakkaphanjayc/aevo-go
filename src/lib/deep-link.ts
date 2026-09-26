const fallbackReturnPath = "/";

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth/")) return fallbackReturnPath;
  return value;
}
