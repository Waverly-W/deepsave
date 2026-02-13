import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import TagsShell from "./tags-shell";
import { authOptions } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return <TagsShell />;
}
