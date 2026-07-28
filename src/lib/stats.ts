import type { Category, CategoryResult, MediaItem } from "@contracts/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  movie: "电影",
  book: "书籍",
  music: "音乐",
};

export const CATEGORY_VERB: Record<Category, string> = {
  movie: "看过",
  book: "读过",
  music: "听过",
};

export interface CategoryStats {
  category: Category;
  total: number;
  fetched: number;
  ratedCount: number;
  avgRating: number | null;
  ratingDist: { star: number; count: number }[];
  markYearDist: { year: string; count: number }[];
  genreTop: { name: string; count: number }[];
  regionTop: { name: string; count: number }[];
  decadeDist: { decade: string; count: number }[];
  creatorTop: { name: string; count: number }[];
  tagTop: { name: string; count: number }[];
}

function topN(counter: Map<string, number>, n: number) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

export function computeStats(category: Category, items: MediaItem[], total: number): CategoryStats {
  const rated = items.filter((i) => i.rating > 0);
  const ratingCounter = new Map<number, number>();
  for (let s = 1; s <= 5; s++) ratingCounter.set(s, 0);
  rated.forEach((i) => ratingCounter.set(i.rating, (ratingCounter.get(i.rating) ?? 0) + 1));

  const markYears = new Map<string, number>();
  items.forEach((i) => {
    const y = i.date?.slice(0, 4);
    if (y && /^\d{4}$/.test(y)) markYears.set(y, (markYears.get(y) ?? 0) + 1);
  });

  const genres = new Map<string, number>();
  const regions = new Map<string, number>();
  const decades = new Map<string, number>();
  const creators = new Map<string, number>();
  const tags = new Map<string, number>();

  items.forEach((i) => {
    i.genres?.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1));
    i.regions?.forEach((r) => regions.set(r, (regions.get(r) ?? 0) + 1));
    if (i.year) {
      const d = `${Math.floor(i.year / 10) * 10}s`;
      decades.set(d, (decades.get(d) ?? 0) + 1);
    }
    if (i.creator) creators.set(i.creator, (creators.get(i.creator) ?? 0) + 1);
    i.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1));
  });

  const avg = rated.length
    ? Math.round((rated.reduce((s, i) => s + i.rating, 0) / rated.length) * 100) / 100
    : null;

  return {
    category,
    total,
    fetched: items.length,
    ratedCount: rated.length,
    avgRating: avg,
    ratingDist: [5, 4, 3, 2, 1].map((s) => ({ star: s, count: ratingCounter.get(s) ?? 0 })),
    markYearDist: [...markYears.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    genreTop: topN(genres, 12),
    regionTop: topN(regions, 10),
    decadeDist: [...decades.entries()]
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade)),
    creatorTop: topN(creators, 10),
    tagTop: topN(tags, 20),
  };
}

export function allItems(results: Partial<Record<Category, CategoryResult | null>>): MediaItem[] {
  return (Object.values(results).filter(Boolean) as CategoryResult[]).flatMap((r) => r.items);
}

/* ---------------- 本地 Markdown 报告 ---------------- */

function bar(count: number, max: number, width = 18): string {
  const n = Math.round((count / Math.max(max, 1)) * width);
  return "█".repeat(n) + "░".repeat(Math.max(width - n, 0));
}

function mdList(rows: { name: string; count: number }[], unit = "次"): string {
  if (!rows.length) return "（数据不足）\n";
  const max = Math.max(...rows.map((r) => r.count));
  return rows
    .map((r, i) => `${i + 1}. **${r.name}** — ${r.count} ${unit} \`${bar(r.count, max)}\``)
    .join("\n");
}

export function buildLocalReport(opts: {
  userName: string;
  doubanId: string;
  results: Partial<Record<Category, CategoryResult | null>>;
  stats: CategoryStats[];
}): string {
  const { userName, doubanId, results, stats } = opts;
  const items = allItems(results);
  const date = new Date().toLocaleDateString("zh-CN");
  const lines: string[] = [];

  lines.push(`# ${userName} 的豆瓣书影音档案分析`);
  lines.push("");
  lines.push(`> 数据源：豆瓣公开档案（ID：${doubanId}） · 生成时间：${date}`);
  lines.push("");

  // 总览
  lines.push(`## 一、总体概览`);
  lines.push("");
  lines.push("| 类别 | 标记总数 | 本次获取 | 已评分 | 平均评分 |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const s of stats) {
    lines.push(
      `| ${CATEGORY_LABEL[s.category]} | ${s.total} | ${s.fetched} | ${s.ratedCount} | ${s.avgRating ?? "—"} |`,
    );
  }
  lines.push("");

  const rated = items.filter((i) => i.rating > 0);
  const five = rated.filter((i) => i.rating === 5).length;
  const low = rated.filter((i) => i.rating <= 2).length;
  lines.push(
    `累计标记 **${items.length}** 条（评分 ${rated.length} 条），其中五星 **${five}** 条（${rated.length ? Math.round((five / rated.length) * 100) : 0}%），两星及以下 **${low}** 条。`,
  );
  lines.push("");

  // 活跃度
  const activity = new Map<string, number>();
  items.forEach((i) => {
    const y = i.date?.slice(0, 4);
    if (y && /^\d{4}$/.test(y)) activity.set(y, (activity.get(y) ?? 0) + 1);
  });
  const actRows = [...activity.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));
  if (actRows.length) {
    lines.push(`## 二、标记活跃度（按标记年份）`);
    lines.push("");
    const max = Math.max(...actRows.map((r) => r.count));
    actRows.forEach((r) => lines.push(`- **${r.year}**：${r.count} 条 \`${bar(r.count, max)}\``));
    const peak = [...actRows].sort((a, b) => b.count - a.count)[0];
    lines.push("");
    lines.push(`高峰出现在 **${peak.year} 年**（${peak.count} 条）。`);
    lines.push("");
  }

  // 分类详情
  let section = 3;
  for (const s of stats) {
    if (!s.fetched) continue;
    const label = CATEGORY_LABEL[s.category];
    lines.push(`## ${["三", "四", "五"][section - 3] ?? section}、${label}偏好`);
    lines.push("");
    lines.push(`**评分分布**（${s.ratedCount} 条已评分，平均 ${s.avgRating ?? "—"} 星）：`);
    lines.push("");
    const rMax = Math.max(...s.ratingDist.map((r) => r.count), 1);
    s.ratingDist.forEach((r) =>
      lines.push(`- ${"★".repeat(r.star)}${"☆".repeat(5 - r.star)}：${r.count} 条 \`${bar(r.count, rMax)}\``),
    );
    lines.push("");
    if (s.genreTop.length) {
      lines.push(`**类型 Top ${Math.min(s.genreTop.length, 10)}**：`);
      lines.push("");
      lines.push(mdList(s.genreTop.slice(0, 10), "部"));
      lines.push("");
    }
    if (s.regionTop.length) {
      lines.push(`**地区 Top ${Math.min(s.regionTop.length, 8)}**：`);
      lines.push("");
      lines.push(mdList(s.regionTop.slice(0, 8), "部"));
      lines.push("");
    }
    if (s.decadeDist.length) {
      lines.push(`**年代分布**：`);
      lines.push("");
      const dMax = Math.max(...s.decadeDist.map((r) => r.count));
      s.decadeDist.forEach((r) =>
        lines.push(`- ${r.decade}：${r.count} 部 \`${bar(r.count, dMax)}\``),
      );
      lines.push("");
    }
    if (s.creatorTop.length) {
      lines.push(`**最常标记的${s.category === "book" ? "作者" : "表演者"}**：`);
      lines.push("");
      lines.push(mdList(s.creatorTop.slice(0, 8), s.category === "book" ? "本" : "张"));
      lines.push("");
    }
    section++;
  }

  // 标签
  const tagCounter = new Map<string, number>();
  items.forEach((i) => i.tags.forEach((t) => tagCounter.set(t, (tagCounter.get(t) ?? 0) + 1)));
  const tagRows = topN(tagCounter, 16);
  if (tagRows.length) {
    lines.push(`## 六、个人标签云`);
    lines.push("");
    lines.push(tagRows.map((t) => `\`${t.name}×${t.count}\``).join(" "));
    lines.push("");
  }

  // 五星清单
  const fiveItems = rated
    .filter((i) => i.rating === 5)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (fiveItems.length) {
    lines.push(`## 七、五星好评清单（${fiveItems.length} 条）`);
    lines.push("");
    fiveItems.slice(0, 40).forEach((i) => {
      const c = i.comment ? ` — ${i.comment}` : "";
      lines.push(`- **${i.mainTitle}**（${CATEGORY_LABEL[i.category]} · ${i.date}）${c}`);
    });
    if (fiveItems.length > 40) lines.push(`- …… 其余 ${fiveItems.length - 40} 条从略`);
    lines.push("");
  }

  // 最近标记
  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  if (recent.length) {
    lines.push(`## 八、最近标记（Top 20）`);
    lines.push("");
    recent.forEach((i) => {
      const star = i.rating ? ` ${"★".repeat(i.rating)}` : "";
      lines.push(`- ${i.date} · [${CATEGORY_LABEL[i.category]}] **${i.mainTitle}**${star}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("*本报告由本地统计自动生成，仅供娱乐与参考。*");
  return lines.join("\n");
}

/* ---------------- AI 输入载荷 ---------------- */

export function buildAiPayload(
  results: Partial<Record<Category, CategoryResult | null>>,
  stats: CategoryStats[],
): string {
  const items = allItems(results);
  const parts: string[] = [];

  for (const s of stats) {
    if (!s.fetched) continue;
    const label = CATEGORY_LABEL[s.category];
    parts.push(`【${label}】共标记 ${s.total} 条，已评分 ${s.ratedCount} 条，平均 ${s.avgRating ?? "无"} 星`);
    parts.push(`评分分布：${s.ratingDist.map((r) => `${r.star}星×${r.count}`).join("，")}`);
    if (s.genreTop.length)
      parts.push(`类型偏好：${s.genreTop.slice(0, 10).map((g) => `${g.name}×${g.count}`).join("，")}`);
    if (s.regionTop.length)
      parts.push(`地区偏好：${s.regionTop.slice(0, 8).map((g) => `${g.name}×${g.count}`).join("，")}`);
    if (s.decadeDist.length)
      parts.push(`年代分布：${s.decadeDist.map((g) => `${g.decade}:${g.count}`).join("，")}`);
    if (s.creatorTop.length)
      parts.push(
        `高频${s.category === "book" ? "作者" : "表演者"}：${s.creatorTop
          .slice(0, 8)
          .map((g) => `${g.name}×${g.count}`)
          .join("，")}`,
      );
    parts.push("");
  }

  const tagCounter = new Map<string, number>();
  items.forEach((i) => i.tags.forEach((t) => tagCounter.set(t, (tagCounter.get(t) ?? 0) + 1)));
  const tags = topN(tagCounter, 15);
  if (tags.length) parts.push(`个人标签：${tags.map((t) => `${t.name}×${t.count}`).join("，")}\n`);

  const rated = items.filter((i) => i.rating > 0);
  const five = rated
    .filter((i) => i.rating === 5)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
  if (five.length) {
    parts.push(`【五星好评（${rated.filter((i) => i.rating === 5).length} 条，列出最近 50 条）】`);
    five.forEach((i) =>
      parts.push(
        `- [${CATEGORY_LABEL[i.category]}] ${i.mainTitle}${i.year ? `（${i.year}）` : ""}${i.comment ? `，短评：${i.comment.slice(0, 80)}` : ""}`,
      ),
    );
    parts.push("");
  }

  const low = rated
    .filter((i) => i.rating <= 2)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  if (low.length) {
    parts.push(`【低分（${rated.filter((i) => i.rating <= 2).length} 条，列出 20 条）】`);
    low.forEach((i) =>
      parts.push(
        `- [${CATEGORY_LABEL[i.category]}] ${i.mainTitle}（${i.rating}星）${i.comment ? `，短评：${i.comment.slice(0, 80)}` : ""}`,
      ),
    );
    parts.push("");
  }

  const withComment = items
    .filter((i) => i.comment && i.comment.length > 10)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  if (withComment.length) {
    parts.push(`【近期短评摘选】`);
    withComment.forEach((i) =>
      parts.push(
        `- [${CATEGORY_LABEL[i.category]}] ${i.mainTitle}：${(i.comment ?? "").slice(0, 120)}`,
      ),
    );
    parts.push("");
  }

  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  parts.push(`【最近标记 40 条】`);
  recent.forEach((i) =>
    parts.push(`- ${i.date} [${CATEGORY_LABEL[i.category]}] ${i.mainTitle}${i.rating ? `（${i.rating}星）` : ""}`),
  );

  return parts.join("\n").slice(0, 18000);
}


/* ---------------- 扩展分析（年度 / 地区 / 偏好） ---------------- */

const topNCounter = (c: Map<string, number>, n: number) =>
  [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

export interface YearReport {
  year: number;
  total: number;
  byCategory: { category: Category; count: number }[];
  ratedCount: number;
  avgRating: number | null;
  fiveCount: number;
  monthly: { month: string; count: number }[];
  peakMonth: { month: string; count: number } | null;
  genreTop: { name: string; count: number }[];
  regionTop: { name: string; count: number }[];
  creatorTop: { name: string; count: number }[];
  firstItem: MediaItem | null;
  lastItem: MediaItem | null;
  fiveItems: MediaItem[];
  /** 单月最高连续打卡天数 */
  maxDayStreak: number;
  activeDays: number;
}

export function availableYears(items: MediaItem[]): number[] {
  const set = new Set<number>();
  items.forEach((i) => {
    const y = parseInt(i.date?.slice(0, 4) ?? "", 10);
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b - a);
}

export function computeYearReport(items: MediaItem[], year: number): YearReport | null {
  const list = items.filter((i) => i.date?.startsWith(String(year)));
  if (!list.length) return null;

  const byCat = new Map<Category, number>();
  const monthly = new Map<string, number>();
  const genres = new Map<string, number>();
  const regions = new Map<string, number>();
  const creators = new Map<string, number>();
  const rated = list.filter((i) => i.rating > 0);
  const five = list.filter((i) => i.rating === 5).sort((a, b) => a.date.localeCompare(b.date));

  const daySet = new Set<string>();
  list.forEach((i) => {
    byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1);
    const m = i.date.slice(5, 7);
    if (m) monthly.set(m, (monthly.get(m) ?? 0) + 1);
    i.genres?.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1));
    i.regions?.forEach((r) => regions.set(r, (regions.get(r) ?? 0) + 1));
    if (i.creator) creators.set(i.creator, (creators.get(i.creator) ?? 0) + 1);
    if (i.date) daySet.add(i.date);
  });

  // 最长连续打卡天数
  const days = [...daySet].sort();
  let maxStreak = 0;
  let cur = 1;
  for (let k = 1; k < days.length; k++) {
    const prev = new Date(days[k - 1]).getTime();
    const now = new Date(days[k]).getTime();
    if (Math.round((now - prev) / 86400000) === 1) {
      cur += 1;
    } else {
      maxStreak = Math.max(maxStreak, cur);
      cur = 1;
    }
  }
  maxStreak = Math.max(maxStreak, cur, days.length ? 1 : 0);

  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const monthlyRows = [...monthly.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const peak = monthlyRows.length
    ? [...monthlyRows].sort((a, b) => b.count - a.count)[0]
    : null;

  return {
    year,
    total: list.length,
    byCategory: (["movie", "book", "music"] as Category[])
      .map((c) => ({ category: c, count: byCat.get(c) ?? 0 }))
      .filter((r) => r.count > 0),
    ratedCount: rated.length,
    avgRating: rated.length
      ? Math.round((rated.reduce((s, i) => s + i.rating, 0) / rated.length) * 100) / 100
      : null,
    fiveCount: five.length,
    monthly: monthlyRows,
    peakMonth: peak,
    genreTop: topNCounter(genres, 6),
    regionTop: topNCounter(regions, 6),
    creatorTop: topNCounter(creators, 6),
    firstItem: sorted[0] ?? null,
    lastItem: sorted[sorted.length - 1] ?? null,
    fiveItems: five,
    maxDayStreak: maxStreak,
    activeDays: daySet.size,
  };
}

export interface RegionStat {
  name: string;
  count: number;
  avg: number | null;
  five: number;
  share: number;
}

export function computeRegionAnalysis(items: MediaItem[]): RegionStat[] {
  const movies = items.filter((i) => i.category === "movie" && i.regions && i.regions.length);
  const map = new Map<string, { count: number; sum: number; rated: number; five: number }>();
  movies.forEach((i) => {
    i.regions!.forEach((r) => {
      if (!map.has(r)) map.set(r, { count: 0, sum: 0, rated: 0, five: 0 });
      const e = map.get(r)!;
      e.count += 1;
      if (i.rating > 0) {
        e.sum += i.rating;
        e.rated += 1;
        if (i.rating === 5) e.five += 1;
      }
    });
  });
  return [...map.entries()]
    .map(([name, e]) => ({
      name,
      count: e.count,
      avg: e.rated ? Math.round((e.sum / e.rated) * 100) / 100 : null,
      five: e.five,
      share: movies.length ? Math.round((e.count / movies.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface GenreStat {
  name: string;
  count: number;
  avg: number | null;
  five: number;
}

export function computeGenrePreference(items: MediaItem[]): GenreStat[] {
  const movies = items.filter((i) => i.category === "movie" && i.genres && i.genres.length);
  const map = new Map<string, { count: number; sum: number; rated: number; five: number }>();
  movies.forEach((i) => {
    i.genres!.forEach((g) => {
      if (!map.has(g)) map.set(g, { count: 0, sum: 0, rated: 0, five: 0 });
      const e = map.get(g)!;
      e.count += 1;
      if (i.rating > 0) {
        e.sum += i.rating;
        e.rated += 1;
        if (i.rating === 5) e.five += 1;
      }
    });
  });
  return [...map.entries()]
    .map(([name, e]) => ({
      name,
      count: e.count,
      avg: e.rated ? Math.round((e.sum / e.rated) * 100) / 100 : null,
      five: e.five,
    }))
    .sort((a, b) => b.count - a.count);
}

/** 周几打卡分布（0=周日） */
export function computeWeekdayDist(items: MediaItem[]): { day: string; count: number }[] {
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const counter = new Array(7).fill(0) as number[];
  items.forEach((i) => {
    if (!i.date) return;
    const d = new Date(`${i.date}T00:00:00`);
    if (!isNaN(d.getTime())) counter[d.getDay()] += 1;
  });
  return [1, 2, 3, 4, 5, 6, 0].map((idx) => ({ day: labels[idx], count: counter[idx] }));
}
