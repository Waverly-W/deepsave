import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:10156";

export async function middleware(request: NextRequest) {
  const apiBaseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE_URL;

  if (request.nextUrl.pathname.startsWith("/setup")) {
    try {
      const response = await fetch(`${apiBaseUrl}/system/init-status`, {
        cache: "no-store"
      });
      if (response.ok) {
        const data = (await response.json()) as { initialized?: boolean };
        if (data.initialized) {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      }
    } catch (error) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/setup"]
};
