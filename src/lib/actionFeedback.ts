export type FeedbackKind = "success" | "error";

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
};

export type FeedbackState = { current: Feedback | null };

export type FeedbackAction =
  | { type: "show"; feedback: Feedback }
  | { type: "dismiss" }
  | { type: "timeout" };

export const initialFeedbackState: FeedbackState = { current: null };

export function feedbackReducer(
  state: FeedbackState,
  action: FeedbackAction,
): FeedbackState {
  if (action.type === "show") return { current: action.feedback };
  if (action.type === "dismiss" || action.type === "timeout") {
    return { current: null };
  }
  return state;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function responseErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: string;
    message?: string;
  } | null;
  return payload?.error || payload?.message || fallback;
}
