import { forwardRef, useMemo } from "react";
import type { Category, CategoryResult, MediaItem } from "@contracts/types";
import { computeMilestones } from "./Milestones";
import {
  allItems,
  availableYears,
  CATEGORY_LABEL,
  computeStats,
  computeYearReport,
  normalizeCreators,
  type CategoryStats,
} from "@/lib/stats";

const W = 640;

function BarRow({
  label,
  count,
  max,
  color = "#34d399",
  suffix,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 shrink-0 truncate text-right text-xs text-zinc-400">{label}</div>
      <div className="h-4 flex-1 overflow-hidden rounded-sm bg-zinc-800/80">
        <div
          className="h-full rounded-sm"
          style={{ width: `${Math.max((count / Math.max(max, 1)) * 100, 2)}%`, background: color }}
        />
      </div>
      <div className="num w-12 shrink-0 text-xs text-zinc-400">
        {count}
        {suffix ?? ""}
      </div>
    </div>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline gap-2">
        <div className="h-4 w-1 rounded-full bg-emerald-500" />
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export interface LongImageProps {
  userName: string;
  doubanId: string;
  results: Partial<Record<Category, CategoryResult | null>>;
  qr: string;
  shareUrl: string;
}

/** 分享长图：内容尽量全，html-to-image 截图目标 */
export const ShareLongImage = forwardRef<HTMLDivElement, LongImageProps>(
  function ShareLongImage({ userName, doubanId, results, qr, shareUrl }, ref) {
    const items = useMemo(() => allItems(results), [results]);
    const stats: CategoryStats[] = useMemo(
      () =>
        (Object.entries(results) as [Category, CategoryResult | null][])
          .filter(([, r]) => r?.ok)
          .map(([c, r]) => computeStats(c, r!.items, r!.total)),
      [results],
    );

    const rated = items.filter((i) => i.rating > 0);
    const fiveItems = rated
      .filter((i) => i.rating === 5 && i.cover)
      .sort((a, b) => b.date.localeCompare(a.date));
    const overallAvg = rated.length
      ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(2)
      : null;

    // 年度活跃
    const activity = useMemo(() => {
      const map = new Map<string, number>();
      items.forEach((i) => {
        const y = i.date?.slice(0, 4);
        if (y && /^\d{4}$/.test(y)) map.set(y, (map.get(y) ?? 0) + 1);
      });
      return [...map.entries()]
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year.localeCompare(b.year));
    }, [items]);

    // 作者 / 表演者
    const bookCreators = useMemo(() => {
      const m = new Map<string, number>();
      items
        .filter((i) => i.category === "book")
        .forEach((i) =>
          normalizeCreators(i.creator).forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)),
        );
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    }, [items]);
    const musicCreators = useMemo(() => {
      const m = new Map<string, number>();
      items
        .filter((i) => i.category === "music")
        .forEach((i) =>
          normalizeCreators(i.creator).forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)),
        );
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    }, [items]);

    // 标签
    const tags = useMemo(() => {
      const m = new Map<string, number>();
      items.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
    }, [items]);

    // 最近一年小报告
    const latestYear = availableYears(items)[0];
    const yearReport = latestYear ? computeYearReport(items, latestYear) : null;

    const milestones = computeMilestones(items);
    const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const movieStats = stats.find((s) => s.category === "movie");
    const today = new Date().toLocaleDateString("zh-CN");

    return (
      <div
        ref={ref}
        className="relative overflow-hidden bg-zinc-950 text-zinc-100"
        style={{ width: W, fontFamily: "system-ui, sans-serif" }}
      >
        {/* 背景 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.08) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />

        {/* 头部 */}
        <div className="relative px-8 pt-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-base font-bold text-emerald-950">
              豆
            </div>
            <div className="text-xs tracking-widest text-emerald-400">DOUBAN LENS · 书影音档案</div>
            <div className="ml-auto text-[11px] text-zinc-600">{today}</div>
          </div>
          <div className="mt-6 text-3xl font-bold leading-snug">
            <span className="text-emerald-400">{userName}</span>
            <span> 的书影音宇宙</span>
          </div>
          <div className="mt-1.5 text-xs text-zinc-500">
            豆瓣 ID：{doubanId} · 共标记 {items.length} 条 · 五星 {fiveItems.length} 条
            {overallAvg ? ` · 综合评分 ${overallAvg}` : ""}
          </div>

          {/* 数据三格 */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {(["movie", "book", "music"] as Category[]).map((c) => (
              <div key={c} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                <div className="text-[11px] text-zinc-500">{CATEGORY_LABEL[c]}</div>
                <div className="num mt-0.5 text-2xl font-bold">{results[c]?.fetched ?? 0}</div>
                <div className="text-[10px] text-zinc-600">
                  均分 {stats.find((s) => s.category === c)?.avgRating ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative px-8 pb-8">
          {/* 评分分布 */}
          {stats.some((s) => s.ratedCount > 0) && (
            <Section title="评分分布" sub="★5 → ★1">
              <div className="space-y-3">
                {stats
                  .filter((s) => s.ratedCount > 0)
                  .map((s) => (
                    <div key={s.category}>
                      <div className="mb-1 text-[11px] text-zinc-500">
                        {CATEGORY_LABEL[s.category]} · 均分 {s.avgRating ?? "—"}
                      </div>
                      <div className="flex h-4.5 items-end gap-1">
                        {s.ratingDist.map((r) => {
                          const max = Math.max(...s.ratingDist.map((x) => x.count), 1);
                          return (
                            <div key={r.star} className="flex flex-1 flex-col items-center gap-0.5">
                              <div
                                className="w-full rounded-sm bg-amber-400/80"
                                style={{ height: Math.max((r.count / max) * 34, 2) }}
                              />
                              <div className="text-[9px] text-zinc-600">{r.star}★</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          )}

          {/* 活跃度 */}
          {activity.length > 1 && (
            <Section title="标记活跃度" sub="按年份">
              <div className="space-y-1.5">
                {activity.map((a) => (
                  <BarRow
                    key={a.year}
                    label={a.year}
                    count={a.count}
                    max={Math.max(...activity.map((x) => x.count))}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* 里程碑 */}
          {milestones.length > 0 && (
            <Section title="标记里程碑">
              <div className="grid grid-cols-3 gap-2">
                {milestones.slice(0, 9).map((m) => (
                  <div
                    key={m.n}
                    className={`flex items-center gap-2 rounded-lg border p-2 ${
                      m.special === "love"
                        ? "border-pink-500/40 bg-pink-500/5"
                        : m.special === "round"
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded">
                      {m.item.cover ? (
                        <img
                          src={`/api/img?url=${encodeURIComponent(m.item.cover)}`}
                          alt={m.item.mainTitle}
                          className="h-full w-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="h-full w-full bg-zinc-800" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`num text-sm font-bold leading-none ${
                          m.special === "love"
                            ? "text-pink-300"
                            : m.special === "round"
                              ? "text-emerald-300"
                              : "text-zinc-200"
                        }`}
                      >
                        第 {m.n} 部
                      </div>
                      <div className="mt-1 truncate text-[10px] text-zinc-400">{m.item.mainTitle}</div>
                      <div className="text-[9px] text-zinc-600">{m.item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 电影偏好 */}
          {movieStats && movieStats.genreTop.length > 0 && (
            <Section title="观影偏好" sub={`类型 Top ${Math.min(movieStats.genreTop.length, 10)}`}>
              <div className="space-y-1.5">
                {movieStats.genreTop.slice(0, 10).map((g, i) => (
                  <BarRow
                    key={g.name}
                    label={g.name}
                    count={g.count}
                    max={movieStats.genreTop[0].count}
                    color={i < 3 ? "#34d399" : "#3f3f46"}
                  />
                ))}
              </div>
            </Section>
          )}
          {movieStats && movieStats.regionTop.length > 0 && (
            <Section title="制片地区" sub={`覆盖 ${movieStats.regionTop.length}+ 国家/地区`}>
              <div className="space-y-1.5">
                {movieStats.regionTop.slice(0, 8).map((g, i) => (
                  <BarRow
                    key={g.name}
                    label={g.name}
                    count={g.count}
                    max={movieStats.regionTop[0].count}
                    color={i < 3 ? "#60a5fa" : "#3f3f46"}
                  />
                ))}
              </div>
            </Section>
          )}
          {movieStats && movieStats.decadeDist.length > 1 && (
            <Section title="观影年代">
              <div className="space-y-1.5">
                {movieStats.decadeDist.map((g) => (
                  <BarRow
                    key={g.decade}
                    label={g.decade}
                    count={g.count}
                    max={Math.max(...movieStats.decadeDist.map((x) => x.count))}
                    color="#f472b6"
                  />
                ))}
              </div>
            </Section>
          )}

          {/* 作者 / 表演者 */}
          {bookCreators.length > 0 && (
            <Section title="最常读的作者">
              <div className="flex flex-wrap gap-2">
                {bookCreators.map(([name, count], i) => (
                  <span
                    key={name}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      i < 3
                        ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {name} × {count}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {musicCreators.length > 0 && (
            <Section title="最常听的表演者">
              <div className="flex flex-wrap gap-2">
                {musicCreators.map(([name, count], i) => (
                  <span
                    key={name}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      i < 3
                        ? "border-pink-800/60 bg-pink-500/10 text-pink-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {name} × {count}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 标签云 */}
          {tags.length > 0 && (
            <Section title="个人标签">
              <div className="flex flex-wrap gap-1.5">
                {tags.map(([name, count]) => (
                  <span
                    key={name}
                    className="rounded bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    {name}
                    <span className="ml-1 text-zinc-600">{count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 年度时刻 */}
          {yearReport && (
            <Section title={`${yearReport.year} 年度报告速览`}>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs leading-6 text-zinc-300">
                这一年标记了 <b className="text-emerald-300">{yearReport.total}</b> 部作品（
                {yearReport.byCategory.map((r) => `${CATEGORY_LABEL[r.category]} ${r.count}`).join(" · ")}），
                五星 <b className="text-emerald-300">{yearReport.fiveCount}</b> 部，
                打卡 <b className="text-emerald-300">{yearReport.activeDays}</b> 天，
                最长连续 <b className="text-emerald-300">{yearReport.maxDayStreak}</b> 天。
                {yearReport.firstItem && (
                  <>
                    <br />
                    年度第一标：{yearReport.firstItem.mainTitle}（{yearReport.firstItem.date}）
                  </>
                )}
                {yearReport.lastItem && (
                  <>
                    <br />
                    年度收官：{yearReport.lastItem.mainTitle}（{yearReport.lastItem.date}）
                  </>
                )}
              </div>
            </Section>
          )}

          {/* 五星墙 */}
          {fiveItems.length > 0 && (
            <Section title={`五星好评（${fiveItems.length}）`} sub="近期高分">
              <div className="grid grid-cols-6 gap-2">
                {fiveItems.slice(0, 12).map((i: MediaItem) => (
                  <div key={i.category + i.subjectId} className="overflow-hidden rounded-md border border-zinc-800">
                    <div className="aspect-[2/3]">
                      <img
                        src={`/api/img?url=${encodeURIComponent(i.cover ?? "")}`}
                        alt={i.mainTitle}
                        className="h-full w-full object-cover"
                        crossOrigin="anonymous"
                      />
                    </div>
                    <div className="truncate bg-zinc-900/80 px-1 py-0.5 text-center text-[9px] text-zinc-400">
                      {i.mainTitle}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 最近标记 */}
          {recent.length > 0 && (
            <Section title="最近标记">
              <div className="space-y-1.5">
                {recent.map((i) => (
                  <div
                    key={i.category + i.subjectId}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-3 py-1.5 text-xs"
                  >
                    <span className="num text-zinc-500">{i.date}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {CATEGORY_LABEL[i.category]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{i.mainTitle}</span>
                    {i.rating > 0 && (
                      <span className="text-amber-400">{"★".repeat(i.rating)}</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 底部 */}
          <div className="mt-8 flex items-end justify-between border-t border-zinc-800/80 pt-5">
            <div>
              <div className="text-sm font-medium text-zinc-300">
                输入豆瓣 ID，生成你的书影音宇宙
              </div>
              <div className="num mt-1 max-w-[380px] truncate text-[11px] text-zinc-600">
                {shareUrl.replace(/^https?:\/\//, "")}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-700">
                <div className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-[9px] font-bold text-emerald-950">
                  豆
                </div>
                Douban Lens · 豆瓣档案分析
              </div>
            </div>
            {qr && (
              <img src={qr} alt="QR" className="h-[76px] w-[76px] rounded-md border border-zinc-800" />
            )}
          </div>
        </div>
      </div>
    );
  },
);
