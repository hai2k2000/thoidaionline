import type { LegacyEvaluationInput } from "./taskContracts";

type NormalizedLegacyEvaluation = Omit<LegacyEvaluationInput, "employeeId">;

const RATINGS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const EFFORT_WEIGHTS = new Set([1, 2, 3, 5, 8]);
const COMPLETIONS = new Set(["not_done", "done", "excellent"]);

const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf())
    && parsed.toISOString().slice(0, 10) === value;
};

export function normalizeLegacyEvaluationInput(
  input: Record<string, unknown>,
): NormalizedLegacyEvaluation {
  if (!Number.isInteger(input.rating) || !RATINGS.has(input.rating as number)) {
    throw new RangeError("invalid_rating");
  }
  if (
    !Number.isInteger(input.effortWeight)
    || !EFFORT_WEIGHTS.has(input.effortWeight as number)
  ) {
    throw new RangeError("invalid_effort_weight");
  }
  if (typeof input.completion !== "string" || !COMPLETIONS.has(input.completion)) {
    throw new RangeError("invalid_completion");
  }
  if (typeof input.onTime !== "boolean" || typeof input.isFinal !== "boolean") {
    throw new RangeError("invalid_boolean");
  }
  if (!validDate(input.checkpointDate)) {
    throw new RangeError("invalid_checkpoint_date");
  }
  if (
    input.opinion !== undefined
    && input.opinion !== null
    && typeof input.opinion !== "string"
  ) {
    throw new RangeError("invalid_opinion");
  }
  const opinion = typeof input.opinion === "string"
    ? input.opinion.normalize("NFC").trim()
    : "";
  if ([...opinion].length > 10000) throw new RangeError("invalid_opinion");

  return {
    rating: input.rating as number,
    effortWeight: input.effortWeight as number,
    completion: input.completion as NormalizedLegacyEvaluation["completion"],
    onTime: input.onTime,
    opinion: opinion || null,
    checkpointDate: input.checkpointDate,
    isFinal: input.isFinal,
  };
}
