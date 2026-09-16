import "server-only";

import { randomUUID } from "node:crypto";

import {
  canAssignToDepartment,
  canTaskAction,
} from "@/lib/authorization";
import { normalizeLegacyEvaluationInput } from "@/lib/legacyEvaluationValidation";
import {
  apiError,
  apiJson,
  asUuid,
  requireMutationActor,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import { createTaskApplication } from "@/lib/taskHandlerFactory";
import { taskRepository } from "@/lib/taskRepository";
import { taskAssignmentRepository } from "@/lib/taskAssignmentRepository";
import { serverSupabase } from "@/lib/serverSupabase";
import { loadRbacActor } from "@/lib/rbac/repository";
import { can } from "@/lib/rbac/authorization";
import { shadowAuthorize } from "@/lib/rbac/shadow";

const privateAttachments = serverSupabase.storage.from("task-private");

const shadowPermission = (action: string) => {
  if (action === "view") return "task.view";
  if (action === "comment") return "task.comment";
  if (action === "assign") return "task.assign";
  return null;
};

const shadowTaskAction = async (
  user: Parameters<typeof loadRbacActor>[0] & { role_code: string },
  task: Parameters<typeof canTaskAction>[1],
  action: Parameters<typeof canTaskAction>[2],
  legacyResult: boolean,
) => {
  const permission = shadowPermission(action);
  if (!permission) return;
  try {
    const rbacActor = await loadRbacActor(user);
    shadowAuthorize({
      actorId: user.id,
      roleCode: user.role_code,
      permission,
      resourceKind: "task",
      resourceId: task.id,
      legacy: legacyResult,
      rbac: can(rbacActor, permission, {
        kind: "task",
        id: task.id,
        departmentId: task.departmentId,
        createdBy: task.createdBy,
        ownerId: task.ownerId,
        assigneeId: task.assigneeId,
        reviewerId: task.reviewerId,
        participantIds: task.participants.map((participant) => participant.userId),
      }),
    }, (metadata) => console.warn("RBAC shadow discrepancy", metadata));
  } catch {
    // Shadow failures never affect legacy authorization or the client response.
  }
};

export const taskHandlers = createTaskApplication({
  repository: taskRepository,
  readActor: requireReadActor,
  mutationActor: requireMutationActor,
  json: apiJson,
  error: apiError,
  rpcFailure,
  asUuid,
  canAssignToDepartment,
  resolveAssignmentParticipants: (actor, input) => taskAssignmentRepository.resolveParticipants(actor, input),
  canTaskAction,
  shadowTaskAction,
  normalizeLegacyEvaluationInput,
  newUuid: randomUUID,
  uploadPrivateAttachment: async (path, data, mimeType) => {
    const { error } = await privateAttachments.upload(path, data, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });
    return error
      ? { ok: false as const, error: { code: "storage_upload_failed" } }
      : { ok: true as const };
  },
  removePrivateAttachment: async (path) => {
    await privateAttachments.remove([path]);
  },
  signPrivateAttachment: async (path) => {
    const { data, error } = await privateAttachments.createSignedUrl(path, 60);
    return error || !data?.signedUrl
      ? { ok: false as const, error: { code: "storage_sign_failed" } }
      : { ok: true as const, url: data.signedUrl };
  },
});
