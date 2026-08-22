export type ScheduleView = "day" | "week" | "month";

export type AccountPreferences = {
  compactMode: boolean;
  reduceMotion: boolean;
  defaultScheduleView: ScheduleView;
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  compactMode: false,
  reduceMotion: false,
  defaultScheduleView: "month",
};

export function normalizeAccountPreferences(value: unknown): AccountPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ACCOUNT_PREFERENCES };
  }
  const input = value as Record<string, unknown>;
  const view = input.defaultScheduleView;
  return {
    compactMode: input.compactMode === true,
    reduceMotion: input.reduceMotion === true,
    defaultScheduleView:
      view === "day" || view === "week" || view === "month" ? view : "month",
  };
}
