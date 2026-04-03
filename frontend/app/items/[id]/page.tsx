import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DeprecatedItemDetailPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/tags?itemId=${encodeURIComponent(params.id)}`);
}
