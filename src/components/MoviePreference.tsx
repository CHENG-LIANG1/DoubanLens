import { useMemo } from "react";
import {
  Bar,
  BarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { MediaItem } from "@contracts/types";
import { computeGenrePreference, computeWeekdayDist } from "@/lib/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const GREEN = "#34d399";

export function MoviePreference({ items }: { items: MediaItem[] }) {
  const genres = useMemo(() => computeGenrePreference(items), [items]);
  const weekday = useMemo(() => computeWeekdayDist(items), [items]);

  const movies = items.filter((i) => i.category === "movie");
  const rated = movies.filter((i) => i.rating > 0);
  const overallAvg = rated.length
    ? Math.round((rated.reduce((s, i) => s + i.rating, 0) / rated.length) * 100) / 100
    : 0;

  const radarData = genres.slice(0, 8).map((g) => ({ genre: g.name, count: g.count }));
  const avgData = genres.slice(0, 12).map((g) => ({ name: g.name, avg: g.avg ?? 0, count: g.count }));
  const avgMin = avgData.length ? Math.max(0, Math.floor((Math.min(...avgData.map((d) => d.avg)) - 0.3) * 10) / 10) : 0;
  const topGenre = genres[0];
  const mostLoved = [...genres].filter((g) => g.count >= 3 && g.avg).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const peakDay = [...weekday].sort((a, b) => b.count - a.count)[0];
  const fiveRate = rated.length
    ? Math.round((rated.filter((i) => i.rating === 5).length / rated.length) * 100)
    : 0;
  const strictness =
    overallAvg >= 4.3 ? "手非常松，喜欢就五星" : overallAvg >= 3.8 ? "打分偏宽容" : overallAvg >= 3.2 ? "打分中规中矩" : "打分相当严格";

  const radarConfig = { count: { label: "数量", color: GREEN } } satisfies ChartConfig;
  const avgConfig = { avg: { label: "平均评分", color: "#60a5fa" } } satisfies ChartConfig;
  const weekdayConfig = { count: { label: "标记数", color: "#f472b6" } } satisfies ChartConfig;

  if (!movies.length) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="py-16 text-center text-sm text-zinc-500">
          暂无电影数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 口味关键词 */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400">观影口味画像</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 6).map((g, i) => (
              <Badge
                key={g.name}
                variant={i < 3 ? "default" : "secondary"}
                className={
                  i < 3
                    ? "bg-emerald-600/90 text-white hover:bg-emerald-600"
                    : "bg-zinc-800 text-zinc-300"
                }
              >
                {g.name} × {g.count}
              </Badge>
            ))}
          </div>
          <div className="grid gap-2 text-sm leading-6 text-zinc-300 md:grid-cols-2">
            <p>
              · 标记最多的类型是
              <span className="mx-1 font-semibold text-emerald-300">{topGenre?.name ?? "—"}</span>
              （{topGenre?.count ?? 0} 部）
              {mostLoved && topGenre?.name !== mostLoved.name ? (
                <>
                  ；打分最高的类型是
                  <span className="mx-1 font-semibold text-emerald-300">{mostLoved.name}</span>
                  （均分 {mostLoved.avg}）
                </>
              ) : null}
            </p>
            <p>
              · 平均评分 <span className="font-semibold text-amber-300">{overallAvg}</span>，
              {strictness}；五星率 {fiveRate}%
            </p>
            {peakDay && peakDay.count > 0 && (
              <p>
                · 最爱在
                <span className="mx-1 font-semibold text-pink-300">{peakDay.day}</span>
                打卡标记（{peakDay.count} 次）
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 类型雷达 */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-zinc-400">
              类型雷达（Top 8）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-72">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#3f3f46" />
                <PolarAngleAxis dataKey="genre" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar
                  dataKey="count"
                  stroke={GREEN}
                  fill={GREEN}
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 类型均分 */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-zinc-400">
              各类型打分松紧（均分 vs 总平均 {overallAvg}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={avgConfig} className="aspect-auto h-72 w-full">
              <BarChart data={avgData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" domain={[avgMin, 5]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={52}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v, _n, item) => (
                        <span>
                          均分 {v} · {item.payload.count} 部
                        </span>
                      )}
                    />
                  }
                />
                <ReferenceLine x={overallAvg} stroke="#f59e0b" strokeDasharray="4 4" />
                <Bar dataKey="avg" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* 星期打卡 */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-zinc-400">
            一周打卡分布（按标记日期）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={weekdayConfig} className="aspect-auto h-48 w-full">
            <BarChart data={weekday} margin={{ left: -20, right: 8 }}>
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#f472b6" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
