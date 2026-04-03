import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import GraphShell from "./graph-shell";
import { authOptions } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/login");
  }

  return <GraphShell />;
}
