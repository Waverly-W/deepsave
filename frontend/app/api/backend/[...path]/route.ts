import type { NextRequest } from "next/server";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:10156";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    path?: string[];
  };
};

function backendBaseUrl(): string {
  return (
    process.env.API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    DEFAULT_API_BASE_URL
  );
}

async function proxyBackend(request: NextRequest, context: RouteContext) {
  const path = context.params.path?.join("/") || "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${backendBaseUrl()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export const GET = proxyBackend;
export const POST = proxyBackend;
export const PUT = proxyBackend;
export const PATCH = proxyBackend;
export const DELETE = proxyBackend;
export const HEAD = proxyBackend;
