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

export const taskHandlers = createTaskApplication({
  repository: taskRepository,
  readActor: requireReadActor,
  mutationActor: requireMutationActor,
  json: apiJson,
  error: apiError,
  rpcFailure,
  asUuid,
  canAssignToDepartment,
  canTaskAction,
  normalizeLegacyEvaluationInput,
  newUuid: randomUUID,
});
