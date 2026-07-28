import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverImage } from "./CoverImage";

type SortKey = "date" | "rating" | "title" | "year";

export function ItemExplorer({ items }: { items: MediaItem[] }) {
  const [keyword, setKeyword] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [decadeFilter, setDecadeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [showCount, setShowCount] = useState(60);

  const decades = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.year) set.add(`${Math.floor(i.year / 10) * 10}s`);
    });
    return [...set].sort().reverse();
  }, [items]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = items;
    if (kw) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(kw) ||
          i.comment?.toLowerCase().includes(kw) ||
          i.tags.some((t) => t.toLowerCase().includes(kw)) ||
          i.creator?.toLowerCase().includes(kw),
      );
    }
    if (ratingFilter !== "all") {
      const r = parseInt(ratingFilter, 10);
      list = list.filter((i) => i.rating === r);
    }
    if (decadeFilter !== "all") {
      list = list.filter(
        (i) => i.year && `${Math.floor(i.year / 10) * 10}s` === decadeFilter,
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "date":
        sorted.sort((a, b) => b.date.localeCompare(a.date));
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
        break;
      case "title":
        sorted.sort((a, b) => a.mainTitle.localeCompare(b.mainTitle, "zh-CN"));
        break;
      case "year":
        sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        break;
    }
    return sorted;
  }, [items, keyword, ratingFilter, decadeFilter, sort]);

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setShowCount(60);
          }}
          placeholder="搜索标题 / 短评 / 标签 / 作者…"
          className="h-9 w-64 bg-zinc-900/80 border-zinc-700 text-sm placeholder:text-zinc-600"
        />
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="h-9 w-28 bg-zinc-900/80 border-zinc-700 text-sm">
            <SelectValue placeholder="评分" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部评分</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r} 星
              </SelectItem>
            ))}
            <SelectItem value="0">未评分</SelectItem>
          </SelectContent>
        </Select>
        {decades.length > 0 && (
          <Select value={decadeFilter} onValueChange={setDecadeFilter}>
            <SelectTrigger className="h-9 w-32 bg-zinc-900/80 border-zinc-700 text-sm">
              <SelectValue placeholder="年代" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部年代</SelectItem>
              {decades.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-32 bg-zinc-900/80 border-zinc-700 text-sm">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">按标记时间</SelectItem>
            <SelectItem value="rating">按我的评分</SelectItem>
            <SelectItem value="year">按作品年份</SelectItem>
            <SelectItem value="title">按标题</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} / {items.length} 条
        </span>
      </div>

      {/* 条目网格 */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-500">没有匹配的条目</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.slice(0, showCount).map((i) => (
            <div
              key={i.category + i.subjectId}
              className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 transition-all hover:-translate-y-0.5 hover:border-emerald-700/50"
            >
              <div className="relative aspect-[2/3] overflow-hidden">
                <CoverImage
                  src={i.cover}
                  alt={i.mainTitle}
                  className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                />
                {i.rating > 0 && (
                  <div className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-amber-400">
                    {"★".repeat(i.rating)}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <a
                  href={i.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-1 text-sm font-medium leading-snug text-zinc-200 hover:text-emerald-300"
                >
                  <span className="line-clamp-2 flex-1">{i.mainTitle}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                </a>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>{i.date}</span>
                  {i.year ? <span>· {i.year}</span> : null}
                </div>
                {i.creator && (
                  <p className="mt-1 truncate text-[11px] text-zinc-500">{i.creator}</p>
                )}
                {i.comment && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                    “{i.comment}”
                  </p>
                )}
                {i.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {i.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > showCount && (
        <div className="text-center">
          <button
            onClick={() => setShowCount((c) => c + 120)}
            className="btn-secondary rounded-full px-6 py-2 text-sm"
          >
            加载更多（还有 {filtered.length - showCount} 条）
          </button>
        </div>
      )}
    </div>
  );
}
