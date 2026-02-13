import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { apiUrl } from "./api";

const BACKEND_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

function decodeJwtPayload(token: string): { exp?: number } | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }
  const payloadSegment = segments[1];
  const padded = payloadSegment.padEnd(
    payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4),
    "="
  );
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const payload = JSON.parse(
      Buffer.from(normalized, "base64").toString("utf-8")
    ) as { exp?: number };
    return payload;
  } catch {
    return null;
  }
}

function isExpired(token?: string): boolean {
  if (!token) {
    return true;
  }
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }
  return payload.exp <= Math.floor(Date.now() / 1000);
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const password = credentials?.password;
        if (!password) {
          return null;
        }

        const response = await fetch(apiUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
          cache: "no-store"
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as { token?: string };
        if (!payload.token) {
          return null;
        }

        return { id: "admin", token: payload.token };
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: BACKEND_TOKEN_MAX_AGE_SECONDS
  },
  jwt: {
    maxAge: BACKEND_TOKEN_MAX_AGE_SECONDS
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && "token" in user) {
        token.accessToken = user.token as string;
      }
      const accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      if (accessToken && isExpired(accessToken)) {
        delete token.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      const accessToken =
        typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.accessToken =
        accessToken && !isExpired(accessToken) ? accessToken : undefined;
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};
