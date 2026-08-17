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

const privateAttachments = serverSupabase.storage.from("task-private");

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
  normalizeLegacyEvaluationInput,
  newUuid: randomUUID,
  uploadPrivateAttachment: async (path, file) => {
    const { error } = await privateAttachments.upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
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
