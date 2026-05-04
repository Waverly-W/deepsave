const DEFAULT_API_BASE_URL = "http://127.0.0.1:10156";
const API_PROXY_PREFIX = "/api/backend";

export function apiBaseUrl(): string {
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (typeof window !== "undefined") {
    if (publicBase) {
      return publicBase;
    }
    return `${window.location.origin}${API_PROXY_PREFIX}`;
  }

  const serverBase = process.env.API_BASE_URL?.replace(/\/$/, "");
  return serverBase || publicBase || DEFAULT_API_BASE_URL;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}
