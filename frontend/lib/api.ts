const DEFAULT_API_BASE_URL = "http://127.0.0.1:10156";
const DEFAULT_API_PORT = "10156";

export function apiBaseUrl(): string {
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (typeof window !== "undefined") {
    if (publicBase) {
      return publicBase;
    }
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_API_PORT || DEFAULT_API_PORT;
    return `${protocol}//${host}:${port}`;
  }

  const serverBase = process.env.API_BASE_URL?.replace(/\/$/, "");
  return serverBase || publicBase || DEFAULT_API_BASE_URL;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}
