export type ThemeMode = 'dark' | 'light';
export type Settings = {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday; fallback when startDate is empty
  hour: number;
  minute: number;
  autoDownload: boolean;
  startDate?: string | null; // YYYY-MM-DD in device's local timezone
  theme: ThemeMode;
};
export const DEFAULT_SETTINGS: Settings = {enabled: true, dayOfWeek: 0, hour: 20, minute: 0, autoDownload: true, startDate: null, theme: 'dark'};

export type RunStatus = 'running' | 'complete' | 'partial' | 'failed';
export type ChatRecord = {id: string; title: string; projectId: string|null; updatedAt: string|null; hash: string; lastSeenAt: string};
export type Revision = {key: string; chatId: string; hash: string; savedAt: string; raw: unknown};
export type Entry = {chatId: string; hash: string};
export type Snapshot = {id: string; createdAt: string; finishedAt?: string; status: RunStatus; scope: 'all'; entries: Entry[]; discovered: number|null; added: number; changed: number; unchanged: number; errors: string[]; missingAttachments: number; source: string};
export type Log = {time: string; level: 'info'|'warning'|'error'; message: string};

export function nextWeekly(now: Date, settings: Settings): number {
  if (settings.startDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(settings.startDate);
    if (!match) throw Error('Дата должна быть в формате ГГГГ-ММ-ДД');
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const candidate = new Date(year, month - 1, day, settings.hour, settings.minute, 0, 0);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day || year < 2020 || year > 2100) {
      throw Error('Некорректная дата первого резервирования');
    }
    // Use calendar weeks, not 7*24h, preserving local wall-clock time at DST changes.
    if (candidate.getTime() > now.getTime()) return candidate.getTime();
    const dayDelta = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
    const weeks = Math.max(0, Math.floor(dayDelta / 7));
    candidate.setDate(candidate.getDate() + weeks * 7);
    if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
    return candidate.getTime();
  }
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
