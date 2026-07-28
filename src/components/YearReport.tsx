import { useMemo, useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { CalendarDays, Flame, Sparkles, Trophy } from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { availableYears, CATEGORY_LABEL, computeYearReport } from "@/lib/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CoverImage } from "./CoverImage";

const chartConfig = { count: { label: "标记数", color: "#34d399" } } satisfies ChartConfig;

export function YearReport({ items }: { items: MediaItem[] }) {
  const years = useMemo(() => availableYears(items), [items]);
  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? years[0] ?? new Date().getFullYear();
  const report = useMemo(
    () => computeYearReport(items, activeYear),
    [items, activeYear],
  );

  if (!years.length || !report) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="py-16 text-center text-sm text-zinc-500">
          暂无年度数据
        </CardContent>
      </Card>
    );
  }

  const headline = `${report.year} 年，TA 标记了 ${report.total} 部作品`;

  return (
    <div className="space-y-4">
      {/* 年份选择 */}
      <div className="flex items-center gap-3">
        <Select
          value={String(activeYear)}
          onValueChange={(v) => setYear(parseInt(v, 10))}
        >
          <SelectTrigger className="h-9 w-32 bg-zinc-900/80 border-zinc-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y} 年
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-zinc-400">{headline}</p>
      </div>

      {/* 核心数字 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">年度标记</div>
            <div className="mt-1 text-2xl font-bold text-zinc-100">{report.total}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {report.byCategory
                .map((r) => `${CATEGORY_LABEL[r.category]}${r.count}`)
                .join(" · ")}
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">平均评分</div>
            <div className="mt-1 text-2xl font-bold text-amber-300">
              {report.avgRating ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">{report.ratedCount} 条已评分</div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">五星好评</div>
            <div className="mt-1 text-2xl font-bold text-emerald-300">{report.fiveCount}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              占 {report.ratedCount ? Math.round((report.fiveCount / report.ratedCount) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <CalendarDays className="h-3 w-3" />
              打卡天数
            </div>
            <div className="mt-1 text-2xl font-bold text-zinc-100">{report.activeDays}</div>
            <div className="mt-1 text-[11px] text-zinc-500">天有标记记录</div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Flame className="h-3 w-3" />
              最长连续打卡
            </div>
            <div className="mt-1 text-2xl font-bold text-pink-300">{report.maxDayStreak}</div>
            <div className="mt-1 text-[11px] text-zinc-500">天</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 月度活跃 */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-zinc-400">
              月度活跃
              {report.peakMonth ? `（${parseInt(report.peakMonth.month, 10)} 月最猛，${report.peakMonth.count} 条）` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
              <BarChart data={report.monthly} margin={{ left: -20, right: 8 }}>
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 年度之最 */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Trophy className="h-4 w-4" />
              年度时刻
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.firstItem && (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
                  <CoverImage src={report.firstItem.cover} alt={report.firstItem.mainTitle} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-zinc-500">
                    {report.firstItem.date} · 年度第一标
                  </div>
                  <div className="truncate text-sm font-medium text-zinc-200">
                    {report.firstItem.mainTitle}
                  </div>
                </div>
              </div>
            )}
            {report.lastItem && (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
                  <CoverImage src={report.lastItem.cover} alt={report.lastItem.mainTitle} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-zinc-500">
                    {report.lastItem.date} · 年度收官
                  </div>
                  <div className="truncate text-sm font-medium text-zinc-200">
                    {report.lastItem.mainTitle}
                  </div>
                </div>
              </div>
            )}
            {(report.genreTop.length > 0 || report.regionTop.length > 0 || report.creatorTop.length > 0) && (
              <div className="space-y-1.5 pt-1">
                {report.genreTop.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    年度类型
                    {report.genreTop.slice(0, 4).map((g) => (
                      <Badge key={g.name} className="border border-emerald-800/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {report.regionTop.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    年度地区
                    {report.regionTop.slice(0, 4).map((g) => (
                      <Badge key={g.name} className="bg-zinc-800 text-zinc-300 hover:bg-zinc-800">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {report.creatorTop.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    年度人物
                    {report.creatorTop.slice(0, 4).map((g) => (
                      <Badge key={g.name} className="bg-zinc-800 text-zinc-300 hover:bg-zinc-800">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 年度五星墙 */}
      {report.fiveItems.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
              <Sparkles className="h-4 w-4" />
              {report.year} 年度五星榜（{report.fiveItems.length} 部）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {report.fiveItems.slice(0, 16).map((i) => (
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
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                    <p className="truncate text-[10px] text-zinc-200">{i.mainTitle}</p>
                  </div>
                </a>
              ))}
            </div>
            {report.fiveItems.length > 16 && (
              <p className="mt-2 text-xs text-zinc-500">
                … 以及另外 {report.fiveItems.length - 16} 部五星
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
