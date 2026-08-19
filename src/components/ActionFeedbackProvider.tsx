"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import {
  feedbackReducer,
  initialFeedbackState,
  type FeedbackKind,
} from "@/lib/actionFeedback";

type ActionFeedbackContextValue = {
  notify: (kind: FeedbackKind, message: string) => void;
  dismiss: () => void;
};

const ActionFeedbackContext = createContext<ActionFeedbackContextValue | null>(null);
const NOTICE_TIMEOUT_MS = 6000;

export default function ActionFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(feedbackReducer, initialFeedbackState);
  const sequence = useRef(0);

  const notify = useCallback((kind: FeedbackKind, message: string) => {
    sequence.current += 1;
    dispatch({
      type: "show",
      feedback: { id: `${Date.now()}-${sequence.current}`, kind, message },
    });
  }, []);

  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);

  useEffect(() => {
    if (!state.current) return undefined;
    const timer = window.setTimeout(() => dispatch({ type: "timeout" }), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [state.current?.id]);

  return (
    <ActionFeedbackContext.Provider value={{ notify, dismiss }}>
      {children}
      {state.current ? (
        <div className="fixed right-4 top-4 z-[100] w-[min(24rem,calc(100vw-2rem))]">
          <div
            role={state.current.kind === "error" ? "alert" : "status"}
            aria-live={state.current.kind === "error" ? "assertive" : "polite"}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${state.current.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{state.current.message}</span>
              <button type="button" onClick={dismiss} aria-label="Đóng thông báo" className="font-semibold opacity-70 hover:opacity-100">×</button>
            </div>
          </div>
        </div>
      ) : null}
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  const context = useContext(ActionFeedbackContext);
  if (!context) throw new Error("useActionFeedback must be used within ActionFeedbackProvider");
  return context;
}
