import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import SettingsShell from "./settings-shell";
import { authOptions } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/login");
  }

  return <SettingsShell />;
}
