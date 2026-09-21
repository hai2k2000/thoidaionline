export type ShadowClassification =
  | "MATCH"
  | "RESTRICTIVE_MISMATCH"
  | "SECURITY_CRITICAL_MISMATCH";

export type ShadowResult = {
  legacy: boolean;
  rbac: boolean;
  classification: ShadowClassification;
};

export function compareShadowResult(input: { legacy: boolean; rbac: boolean }): ShadowResult {
  const classification: ShadowClassification = input.legacy === input.rbac
    ? "MATCH"
    : input.legacy
      ? "RESTRICTIVE_MISMATCH"
      : "SECURITY_CRITICAL_MISMATCH";
  return { ...input, classification };
}

export type ShadowMetadata = {
  actorId: string;
  roleCode: string;
  permission: string;
  resourceKind?: string;
  resourceId?: string;
  classification: ShadowClassification;
};

export type ShadowInput = Omit<ShadowMetadata, "classification"> & {
  legacy: boolean;
  rbac: boolean;
};

export function shadowAuthorize(
  input: ShadowInput,
  logger: (metadata: ShadowMetadata) => void = () => undefined,
): boolean {
  const result = compareShadowResult(input);
  if (result.classification !== "MATCH") {
    logger({
      actorId: input.actorId,
      roleCode: input.roleCode,
      permission: input.permission,
      resourceKind: input.resourceKind,
      resourceId: input.resourceId,
      classification: result.classification,
    });
  }
  return input.legacy;
}
