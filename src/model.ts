export type Settings = {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday, local timezone
  hour: number;
  minute: number;
  autoDownload: boolean;
};
export const DEFAULT_SETTINGS: Settings = {enabled: true, dayOfWeek: 0, hour: 20, minute: 0, autoDownload: true};
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type RunStatus = 'running' | 'complete' | 'partial' | 'failed';
export type ChatRecord = {id: string; title: string; projectId: string|null; updatedAt: string|null; hash: string; lastSeenAt: string};
export type Revision = {key: string; chatId: string; hash: string; savedAt: string; raw: unknown};
export type Entry = {chatId: string; hash: string};
export type Snapshot = {id: string; createdAt: string; finishedAt?: string; status: RunStatus; scope: 'all'; entries: Entry[]; discovered: number|null; added: number; changed: number; unchanged: number; errors: string[]; missingAttachments: number; source: string};
export type Log = {time: string; level: 'info'|'warning'|'error'; message: string};

export function nextWeekly(now: Date, settings: Settings): number {
  const candidate = new Date(now.getTime());
  candidate.setHours(settings.hour, settings.minute, 0, 0);
  let advance = (settings.dayOfWeek - candidate.getDay() + 7) % 7;
  if (advance === 0 && candidate.getTime() <= now.getTime()) advance = 7;
  candidate.setDate(candidate.getDate() + advance);
  return candidate.getTime();
}

export function safeSegment(s: string): string {
  return (s || 'untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 72) || 'untitled';
}
