import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import TimelineShell from "./timeline-shell";
import { authOptions } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return <TimelineShell />;
}
