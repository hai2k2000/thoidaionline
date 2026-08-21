import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor } from "@/lib/serverApi";
import { notificationRepository } from "@/lib/notificationRepository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const result = await notificationRepository.list(guard.actor.id);
  if (!result.ok) return apiError("operation_failed", 500);
  return apiJson({
    items: result.items,
    unreadCount: result.items.filter((item) => item.unread).length,
  });
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const keys = Array.isArray(body?.keys)
    ? [...new Set(body.keys.filter((key): key is string => typeof key === "string" && key.length > 0 && key.length <= 300))].slice(0, 100)
    : [];
  if (!keys.length) return apiError("invalid_request", 400);
  const result = await notificationRepository.markRead(guard.actor.id, keys);
  return result.ok ? apiJson({ ok: true }) : apiError("operation_failed", 500);
}
