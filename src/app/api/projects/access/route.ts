import { projectRepository } from "@/lib/projectRepository";
import { apiJson, requireReadActor, rpcFailure } from "@/lib/serverApi";
export async function GET() {
 const guard = await requireReadActor(); if (!guard.ok) return guard.response;
 const result = await projectRepository.hasMembership(guard.actor.id);
 return result.ok ? apiJson({ hasMembership: result.data }) : rpcFailure(result.error);
}
