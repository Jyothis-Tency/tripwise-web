/**
 * API origin for axios/fetch.
 * Empty string = same origin (Vite proxies /auth,/owners,/guest,… → localhost:3000).
 * Use empty for Cloudflare tunnel / phone testing so the phone never calls localhost.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw == null || String(raw).trim() === "" || String(raw).trim() === "proxy") {
    return "";
  }
  return String(raw).replace(/\/$/, "");
}
