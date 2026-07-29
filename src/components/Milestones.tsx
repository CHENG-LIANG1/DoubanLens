import { useMemo } from "react";
import { Flag, Heart } from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { CATEGORY_LABEL } from "@/lib/stats";
import { CoverImage } from "./CoverImage";

export interface Milestone {
  n: number;
  item: MediaItem;
  special: "love" | "round" | "first" | null;
}

export function computeMilestones(items: MediaItem[]): Milestone[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.length;
  const nums: { n: number; special: Milestone["special"] }[] = [{ n: 1, special: "first" }];
  for (const n of [100, 520, 1000, 1314]) {
    nums.push({ n, special: n === 520 || n === 1314 ? "love" : "round" });
  }
  for (let n = 2000; n <= total; n += 1000) {
    nums.push({ n, special: "round" });
  }
  return nums
    .filter((m) => m.n <= total)
    .map((m) => ({ n: m.n, item: sorted[m.n - 1], special: m.special }));
}

const SPECIAL_STYLE: Record<string, { ring: string; text: string; label?: string }> = {
  love: { ring: "border-pink-500/40 bg-pink-500/5", text: "text-pink-300", label: "心动纪念" },
  round: { ring: "border-emerald-500/40 bg-emerald-500/5", text: "text-emerald-300" },
  first: { ring: "border-zinc-700 bg-zinc-900/60", text: "text-zinc-200", label: "梦开始的地方" },
};

export function Milestones({ items }: { items: MediaItem[] }) {
  const milestones = useMemo(() => computeMilestones(items), [items]);
  if (!milestones.length) return null;

  return (
    <div className="bento rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
        <Flag className="h-4 w-4" />
        标记里程碑
      </h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {milestones.map((m) => {
          const st = SPECIAL_STYLE[m.special ?? "first"] ?? SPECIAL_STYLE.first;
          return (
            <a
              key={m.n}
              href={m.item.url}
              target="_blank"
              rel="noreferrer"
              className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 ${st.ring}`}
            >
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md">
                <CoverImage src={m.item.cover} alt={m.item.mainTitle} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className={`num text-lg font-bold leading-none ${st.text}`}>
                  第 {m.n} 部
                  {m.special === "love" && <Heart className="ml-1 inline h-3.5 w-3.5 fill-pink-400 text-pink-400" />}
                </div>
                {st.label && <div className="mt-0.5 text-[10px] text-zinc-600">{st.label}</div>}
                <div className="mt-1 truncate text-xs text-zinc-300" title={m.item.mainTitle}>
                  {m.item.mainTitle}
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-600">
                  {CATEGORY_LABEL[m.item.category]} · {m.item.date}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
