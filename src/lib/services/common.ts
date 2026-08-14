import { supabase } from "@/lib/supabase";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = <T = never>(error: string): ServiceResult<T> => ({ ok: false, error });

export const withError = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: string }).message;
    if (msg) return msg;
  }
  return fallback;
};

export const db = supabase;
