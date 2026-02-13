"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { AUTH_UNAUTHORIZED_EVENT } from "../lib/auth-events";

function isPublicPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }
  return pathname === "/login" || pathname === "/setup";
}

export default function AuthRedirectListener() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isRedirectingRef = useRef(false);

  const redirectToLogin = useCallback(async () => {
    if (isRedirectingRef.current || isPublicPath(pathname)) {
      return;
    }
    isRedirectingRef.current = true;
    try {
      await signOut({ redirect: false });
    } catch {
      // Swallow sign-out errors and still force login page navigation.
    }
    router.replace("/login");
  }, [pathname, router]);

  useEffect(() => {
    const onUnauthorized = () => {
      void redirectToLogin();
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [redirectToLogin]);

  useEffect(() => {
    if (status === "authenticated" && !session?.accessToken) {
      void redirectToLogin();
    }
  }, [redirectToLogin, session?.accessToken, status]);

  return null;
}

