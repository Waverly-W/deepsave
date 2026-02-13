import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import HomeShell from "./home-shell";
import { authOptions } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/login");
  }

  return <HomeShell />;
}
