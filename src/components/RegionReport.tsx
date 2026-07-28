import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Globe2 } from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { computeRegionAnalysis } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const PIE_COLORS = ["#34d399", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa", "#4ade80", "#38bdf8", "#fb7185", "#52525b"];

export function RegionReport({ items }: { items: MediaItem[] }) {
  const regions = useMemo(() => computeRegionAnalysis(items), [items]);

  const movies = items.filter((i) => i.category === "movie");
  const pieData = useMemo(() => {
    const top = regions.slice(0, 8);
    const rest = regions.slice(8);
    const rows = top.map((r) => ({ name: r.name, value: r.count }));
    if (rest.length) rows.push({ name: "其他", value: rest.reduce((s, r) => s + r.count, 0) });
    return rows;
  }, [regions]);

  // 地区 × 年代热力图
  const heat = useMemo(() => {
    const topNames = regions.slice(0, 8).map((r) => r.name);
    const decades = new Set<string>();
    movies.forEach((i) => {
      if (i.year) decades.add(`${Math.floor(i.year / 10) * 10}s`);
    });
    const cols = [...decades].sort();
    const grid = new Map<string, number>();
    movies.forEach((i) => {
      if (!i.year || !i.regions) return;
      const d = `${Math.floor(i.year / 10) * 10}s`;
      i.regions.forEach((r) => {
        if (!topNames.includes(r)) return;
        const k = `${r}|${d}`;
        grid.set(k, (grid.get(k) ?? 0) + 1);
      });
    });
    let max = 0;
    grid.forEach((v) => (max = Math.max(max, v)));
    return { rows: topNames, cols, grid, max };
  }, [regions, movies]);

  const chartConfig = {
    value: { label: "数量" },
    ...Object.fromEntries(pieData.map((d, i) => [d.name, { label: d.name, color: PIE_COLORS[i % PIE_COLORS.length] }])),
  } satisfies ChartConfig;

  const fav = regions[0];
  const bestRated = [...regions].filter((r) => r.count >= 3 && r.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];

  if (!regions.length) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="py-16 text-center text-sm text-zinc-500">
          暂无地区数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 洞察 */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Globe2 className="h-4 w-4" />
            制片地区足迹
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {regions.slice(0, 10).map((r, i) => (
              <Badge
                key={r.name}
                className={
                  i < 3
                    ? "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-500"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-800"
                }
              >
                {r.name} {r.share}%
              </Badge>
            ))}
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            看得最多的是
            <span className="mx-1 font-semibold text-emerald-300">{fav.name}</span>
            片（{fav.count} 部，占 {fav.share}%）
            {bestRated && bestRated.name !== fav.name ? (
              <>
                ；而打分最高的是
                <span className="mx-1 font-semibold text-emerald-300">{bestRated.name}</span>
                片（均分 {bestRated.avg}）
              </>
            ) : null}
            ，足迹覆盖 {regions.length} 个国家/地区。
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 占比环图 */}
        <Card className="border-zinc-800 bg-zinc-900/50 lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-zinc-400">地区占比</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-64">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  strokeWidth={2}
                >
                  {pieData.map((d, i) => (
                    <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#09090b" />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {pieData.slice(0, 6).map((d, i) => (
                <span key={d.name} className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {d.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 明细表 */}
        <Card className="border-zinc-800 bg-zinc-900/50 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">地区明细</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">地区</TableHead>
                  <TableHead className="text-right text-zinc-500">数量</TableHead>
                  <TableHead className="text-right text-zinc-500">占比</TableHead>
                  <TableHead className="text-right text-zinc-500">均分</TableHead>
                  <TableHead className="text-right text-zinc-500">五星</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.slice(0, 15).map((r, i) => (
                  <TableRow key={r.name} className="border-zinc-800/60 hover:bg-zinc-800/30">
                    <TableCell className="font-medium text-zinc-200">
                      {i < 3 ? <span className="mr-1.5 text-emerald-400">{i + 1}</span> : <span className="mr-1.5 text-zinc-600">{i + 1}</span>}
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right text-zinc-300">{r.count}</TableCell>
                    <TableCell className="text-right text-zinc-400">{r.share}%</TableCell>
                    <TableCell className="text-right text-amber-300">{r.avg ?? "—"}</TableCell>
                    <TableCell className="text-right text-zinc-300">{r.five}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 地区×年代热力图 */}
      {heat.rows.length > 0 && heat.cols.length > 1 && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              地区 × 年代热力图（颜色越深看得越多）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider delayDuration={100}>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `72px repeat(${heat.cols.length}, minmax(36px, 1fr))` }}
                >
                  <div />
                  {heat.cols.map((d) => (
                    <div key={d} className="text-center text-[11px] text-zinc-500">
                      {d}
                    </div>
                  ))}
                  {heat.rows.map((r) => (
                    <>
                      <div key={r} className="flex items-center text-[11px] text-zinc-400">
                        {r}
                      </div>
                      {heat.cols.map((d) => {
                        const v = heat.grid.get(`${r}|${d}`) ?? 0;
                        const opacity = v === 0 ? 0.05 : 0.15 + (v / Math.max(heat.max, 1)) * 0.85;
                        return (
                          <Tooltip key={`${r}-${d}`}>
                            <TooltipTrigger asChild>
                              <div
                                className="flex aspect-[4/3] items-center justify-center rounded text-[10px]"
                                style={{
                                  background: `rgba(52, 211, 153, ${opacity})`,
                                  color: opacity > 0.5 ? "#022c22" : "#71717a",
                                }}
                              >
                                {v > 0 ? v : ""}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                              {r} · {d}：{v} 部
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
