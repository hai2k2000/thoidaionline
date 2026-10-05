export const candidateKey = (item) => item.taskId ?? `${item.rowNumber ?? "row"}:${item.title}`;

export const createDuplicateDecisions = (candidates) => Object.fromEntries(
  candidates.filter((item) => item.duplicateRequiresConfirmation).map((item) => [candidateKey(item), null]),
);

export const summarizeImportCandidates = (candidates, decisions) => {
  const mappedRows = candidates.filter((item) => !item.duplicateRequiresConfirmation && item.mappingConfidence === "HIGH" && (item.assigneeIds?.length ?? 0) > 0).length;
  return {
    total: candidates.length,
    newRows: candidates.filter((item) => !item.duplicateRequiresConfirmation).length - mappedRows,
    mappedRows,
    duplicateRows: candidates.filter((item) => item.duplicateRequiresConfirmation).length,
    unresolvedDuplicateRows: Object.values(decisions).filter((value) => value === null).length,
  };
};

export const buildConfirmedImportItems = (candidates, decisions) => candidates.flatMap((item) => {
  const key = candidateKey(item);
  const duplicateDecision = item.duplicateRequiresConfirmation ? decisions[key] : null;
  if (item.duplicateRequiresConfirmation && !["merge", "separate", "skip"].includes(duplicateDecision)) {
    throw new Error("duplicate decision required");
  }
  if (duplicateDecision === "skip") return [];
  const mergeTaskId = item.taskId ?? item.existingTask?.id ?? null;
  return [{
    taskId: duplicateDecision === "separate" ? null : mergeTaskId,
    title: item.title,
    description: item.description ?? null,
    assigneeIds: item.mappingConfidence === "HIGH" ? item.assigneeIds ?? [] : [],
    collaboratorIds: item.mappingConfidence === "HIGH" ? item.collaboratorIds ?? [] : [],
    dueDate: item.dueDate ?? null,
    status: item.status ?? "planned",
    workSource: item.workSource ?? "department_plan",
    milestone: item.milestone ?? null,
    periodRelation: item.periodRelation,
    periodGoal: item.periodGoal?.trim() || item.title,
    carryOverReason: item.carryOverReason ?? null,
    duplicateRequiresConfirmation: Boolean(item.duplicateRequiresConfirmation),
    duplicateDecision,
  }];
});