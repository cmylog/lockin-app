export type Goal = { id: string; title: string; createdAt: string };
export type Task = { id: string; title: string; goalId: string | null; plannedDate: string; createdAt: string; completedAt: string | null };
export type Habit = { id: string; title: string; createdAt: string; completedDates: string[] };
export type FocusSession = { id: string; taskId: string | null; goalId: string | null; startedAt: string; finishedAt: string; durationSeconds: number };
export type FocusState = { taskId: string | null; durationMinutes: number; startedAt: string; runStartedAt: number | null; endAt: number | null; remainingSeconds: number; elapsedSeconds: number };
export type AppData = { goals: Goal[]; tasks: Task[]; habits: Habit[]; sessions: FocusSession[]; focus: FocusState | null };

export const STORAGE_KEY = "lockin-app-v1";
export const emptyData: AppData = { goals: [], tasks: [], habits: [], sessions: [], focus: null };

export function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.goals) || !Array.isArray(value.tasks) || !Array.isArray(value.habits) || !Array.isArray(value.sessions)) return emptyData;
    return { ...emptyData, ...value };
  } catch {
    return emptyData;
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function minutesLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function habitStreak(dates: string[], today: string): number {
  const done = new Set(dates);
  const day = new Date(`${today}T12:00:00`);
  if (!done.has(today)) day.setDate(day.getDate() - 1);
  let count = 0;
  while (done.has(localDate(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
