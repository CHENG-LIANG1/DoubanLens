import type { Category, CategoryResult } from "@contracts/types";

export interface CachedRecord {
  version: 1;
  doubanId: string;
  userName: string;
  results: Partial<Record<Category, CategoryResult | null>>;
  savedAt: number;
}

export interface RecentEntry {
  doubanId: string;
  userName: string;
  savedAt: number;
  total: number;
}

const RECORD_KEY = "douban-lens:record";
const RECENT_KEY = "douban-lens:recent";

export function loadRecord(): CachedRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRecord;
    if (parsed?.version !== 1 || !parsed.doubanId || !parsed.results) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRecord(rec: CachedRecord): boolean {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(rec));
    return true;
  } catch {
    // 存储超限时静默失败（数据量过大）
    return false;
  }
}

export function clearRecord() {
  try {
    localStorage.removeItem(RECORD_KEY);
  } catch {
    /* ignore */
  }
}

export function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry) {
  try {
    const list = loadRecent().filter((e) => e.doubanId !== entry.doubanId);
    list.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* ignore */
  }
}

export function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
