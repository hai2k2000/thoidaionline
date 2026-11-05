import { apiJson, requireReadActor } from "@/lib/serverApi";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const configured = process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY && /^(mailto:|https:\/\/)/.test(process.env.WEB_PUSH_SUBJECT ?? "");
  return apiJson({ publicKey: configured ? process.env.WEB_PUSH_VAPID_PUBLIC_KEY : null });
}
