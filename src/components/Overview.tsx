import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Book, Clapperboard, Crosshair, Music3, Rocket, Star } from "lucide-react";
import type { Category, CategoryResult, MediaItem } from "@contracts/types";
import { CATEGORY_LABEL, type CategoryStats } from "@/lib/stats";
import { CoverImage } from "./CoverImage";
import { Milestones } from "./Milestones";

const GREEN = "#34d399";
const CATEGORY_ICON: Record<Category, typeof Clapperboard> = {
  movie: Clapperboard,
  book: Book,
  music: Music3,
};

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bento border border-zinc-800 bg-zinc-900/50 p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-medium text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function RatingBar({ stats }: { stats: CategoryStats }) {
  const total = Math.max(...stats.ratingDist.map((r) => r.count), 1);
  return (
    <div className="space-y-1.5">
      {stats.ratingDist.map((r) => (
        <div key={r.star} className="flex items-center gap-2 text-xs">
          <span className="w-8 shrink-0 text-amber-400">{r.star}★</span>
          <div className="h-3 flex-1 rounded bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded bg-gradient-to-r from-amber-500 to-amber-400"
              style={{ width: `${(r.count / total) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-zinc-500">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export function Overview({
  results,
  stats,
  onEnterGlobe,
}: {
  results: Partial<Record<Category, CategoryResult | null>>;
  stats: CategoryStats[];
  /** 有电影数据时提供：点击切到足迹地球 tab */
  onEnterGlobe?: () => void;
}) {
  const items = useMemo(
    () =>
      (Object.values(results).filter(Boolean) as CategoryResult[]).flatMap((r) => r.items),
    [results],
  );

  const activity = useMemo(() => {
    const map = new Map<string, { movie: number; book: number; music: number }>();
    items.forEach((i) => {
      const y = i.date?.slice(0, 4);
      if (!y || !/^\d{4}$/.test(y)) return;
      if (!map.has(y)) map.set(y, { movie: 0, book: 0, music: 0 });
      map.get(y)![i.category] += 1;
    });
    return [...map.entries()]
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [items]);

  const recent = useMemo(
    () =>
      [...items]
        .filter((i) => i.cover)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14),
    [items],
  );

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => i.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24);
  }, [items]);

  const totalRated = items.filter((i) => i.rating > 0);
  const overallAvg = totalRated.length
    ? (totalRated.reduce((s, i) => s + i.rating, 0) / totalRated.length).toFixed(2)
    : null;
  const fiveCount = totalRated.filter((i) => i.rating === 5).length;

  const movieStats = stats.find((s) => s.category === "movie");
  const bookStats = stats.find((s) => s.category === "book");
  const musicStats = stats.find((s) => s.category === "music");

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = CATEGORY_ICON[s.category];
          return (
            <div
              key={s.category}
              className="rounded-xl bento border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Icon className="h-3.5 w-3.5" />
                {CATEGORY_LABEL[s.category]}（{s.fetched}
                {s.total > s.fetched ? `/${s.total}` : ""}）
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">
                {s.avgRating ?? "—"}
                <span className="ml-1 text-xs font-normal text-zinc-500">平均评分</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">{s.ratedCount} 条已评分</div>
            </div>
          );
        })}
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400/80">
            <Star className="h-3.5 w-3.5" />
            总体
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">
            {overallAvg ?? "—"}
            <span className="ml-1 text-xs font-normal text-emerald-500/70">综合平均</span>
          </div>
          <div className="mt-1 text-xs text-emerald-500/70">
            五星 {fiveCount} 条 · 共标记 {items.length} 条
          </div>
        </div>
      </div>

      {/* 主打功能：足迹地球入口卡 */}
      {onEnterGlobe && movieStats && (movieStats.regionTop.length ?? 0) > 0 && (
        <button
          onClick={onEnterGlobe}
          className="bento group relative block w-full overflow-hidden rounded-2xl border border-emerald-500/25 bg-zinc-950/80 text-left"
        >
          <div className="hud-grid relative flex items-center gap-5 p-5 md:gap-8 md:p-7">
            {/* 左侧文案 */}
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] tracking-wider text-emerald-300">
                <Crosshair className="h-3 w-3" />
                主打功能
              </span>
              <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                <span className="text-shimmer">足迹地球</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {movieStats.fetched} 部电影散落在{" "}
                <b className="text-emerald-300">{movieStats.regionTop.length}</b>{" "}
                个国家/地区——转动 3D 地球，点亮你的观影版图
              </p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.35)] transition group-hover:bg-emerald-400 group-hover:shadow-[0_0_32px_rgba(52,211,153,0.5)]">
                <Rocket className="h-4 w-4" />
                启动全球扫描
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
            {/* 右侧雷达球装饰 */}
            <div className="relative mr-2 hidden h-28 w-28 shrink-0 sm:block md:h-36 md:w-36">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(52,211,153,0.5),rgba(6,20,14,0.9)_62%)] shadow-[0_0_50px_rgba(52,211,153,0.35),inset_0_0_30px_rgba(52,211,153,0.2)]" />
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="radar-sweep absolute inset-0 rounded-full" />
              </div>
              <div className="absolute inset-0 rounded-full border border-emerald-400/40" />
              <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 bg-emerald-400/20" />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-emerald-400/20" />
              <Crosshair className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-emerald-300" />
            </div>
          </div>
        </button>
      )}

      {/* 里程碑 */}
      <Milestones items={items} />

      {/* 活跃度曲线 */}
      {activity.length > 1 && (
        <ChartCard title="标记活跃度（按年份 · 三类合计）">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={activity} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMovie" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gMusic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#3f3f46", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="movie" name="电影" stackId="1" stroke={GREEN} fill="url(#gMovie)" />
                <Area type="monotone" dataKey="book" name="书籍" stackId="1" stroke="#60a5fa" fill="url(#gBook)" />
                <Area type="monotone" dataKey="music" name="音乐" stackId="1" stroke="#f472b6" fill="url(#gMusic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* 评分分布 */}
      <div className="grid gap-3 md:grid-cols-3">
        {stats.map((s) =>
          s.ratedCount ? (
            <ChartCard
              key={s.category}
              title={`${CATEGORY_LABEL[s.category]}评分分布 · 平均 ${s.avgRating ?? "—"}`}
            >
              <RatingBar stats={s} />
            </ChartCard>
          ) : null,
        )}
      </div>

      {/* 类型 / 地区 / 年代 */}
      <div className="grid gap-3 md:grid-cols-3">
        {movieStats && movieStats.genreTop.length > 0 && (
          <ChartCard title="电影类型 Top 10">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={movieStats.genreTop.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={56}
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                    {movieStats.genreTop.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={i < 3 ? GREEN : "#3f3f46"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
        {movieStats && movieStats.regionTop.length > 0 && (
          <ChartCard title="制片地区 Top 8">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={movieStats.regionTop.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
        {movieStats && movieStats.decadeDist.length > 0 && (
          <ChartCard title="上映年代分布">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={movieStats.decadeDist} margin={{ top: 0, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="decade" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={20} fill="#f472b6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>

      {/* 作者 / 表演者 */}
      <div className="grid gap-3 md:grid-cols-2">
        {bookStats && bookStats.creatorTop.length > 0 && (
          <ChartCard title="最常读的作者">
            <div className="flex flex-wrap gap-2">
              {bookStats.creatorTop.map((c, i) => (
                <span
                  key={c.name}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    i < 3
                      ? "border-emerald-700 bg-emerald-950/50 text-emerald-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {c.name} × {c.count}
                </span>
              ))}
            </div>
          </ChartCard>
        )}
        {musicStats && musicStats.creatorTop.length > 0 && (
          <ChartCard title="最常听的表演者">
            <div className="flex flex-wrap gap-2">
              {musicStats.creatorTop.map((c, i) => (
                <span
                  key={c.name}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    i < 3
                      ? "border-pink-800 bg-pink-950/40 text-pink-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {c.name} × {c.count}
                </span>
              ))}
            </div>
          </ChartCard>
        )}
        {topTags.length > 0 && (
          <ChartCard title="个人标签云" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {topTags.map(([name, count], i) => (
                <span
                  key={name}
                  className="rounded-md bg-zinc-800/80 px-2.5 py-1 text-zinc-300"
                  style={{ fontSize: Math.max(11, 15 - i * 0.4) }}
                >
                  {name}
                  <span className="ml-1 text-zinc-500">{count}</span>
                </span>
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* 最近标记封面墙 */}
      {recent.length > 0 && (
        <ChartCard title="最近标记">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {recent.map((i: MediaItem) => (
              <a
                key={i.category + i.subjectId}
                href={i.url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-[2/3] overflow-hidden rounded-md"
                title={`${i.mainTitle} · ${i.date}`}
              >
                <CoverImage
                  src={i.cover}
                  alt={i.mainTitle}
                  className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
                  <p className="truncate text-[10px] text-zinc-200">{i.mainTitle}</p>
                  {i.rating > 0 && (
                    <p className="text-[9px] text-amber-400">{"★".repeat(i.rating)}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
