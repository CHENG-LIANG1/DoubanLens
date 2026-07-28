import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Book, CalendarDays, CheckCircle2, Clapperboard, Clock3, FileText, Globe2,
  Heart, History, LayoutDashboard, Loader2, Music3, RefreshCcw, RotateCcw, XCircle,
} from "lucide-react";
import type { Category, CategoryResult, MediaItem } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { allItems, CATEGORY_LABEL, computeStats } from "@/lib/stats";
import {
  formatSavedAt, loadRecord, loadRecent, pushRecent, saveRecord, type RecentEntry,
} from "@/lib/cache";
import { ScrapeForm } from "@/components/ScrapeForm";
import { Overview } from "@/components/Overview";
import { ItemExplorer } from "@/components/ItemExplorer";
import { ReportPanel } from "@/components/ReportPanel";
import { ShareDialog } from "@/components/ShareDialog";
import { MoviePreference } from "@/components/MoviePreference";
import { RegionReport } from "@/components/RegionReport";
import { YearReport } from "@/components/YearReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stage = "idle" | "loading" | "done";

const CATEGORY_ORDER: Category[] = ["movie", "book", "music"];
const CATEGORY_ICON: Record<Category, typeof Clapperboard> = {
  movie: Clapperboard,
  book: Book,
  music: Music3,
};

const FEATURES = [
  "评分分布", "类型雷达", "地区热力图", "年度报告", "观影偏好",
  "AI 深度解读", "分享海报", "五星墙", "打卡 streak", "Markdown 导出",
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [doubanId, setDoubanId] = useState("");
  const [results, setResults] = useState<Partial<Record<Category, CategoryResult | null>>>({});
  const [currentCat, setCurrentCat] = useState<Category | null>(null);
  const [live, setLive] = useState<Partial<Record<Category, { fetched: number; total: number }>>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [cachedId, setCachedId] = useState("");

  const chunkMut = trpc.douban.scrapeChunk.useMutation();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadFromCache = (rec: NonNullable<ReturnType<typeof loadRecord>>) => {
    setDoubanId(rec.doubanId);
    setResults(rec.results);
    setSavedAt(rec.savedAt);
    setStage("done");
    setSearchParams({ id: rec.doubanId }, { replace: true });
  };

  const scrape = async (id: string, cookie?: string) => {
    setStage("loading");
    setResults({});
    setLive({});
    setSavedAt(null);
    setDoubanId(id);

    for (const cat of CATEGORY_ORDER) {
      setCurrentCat(cat);
      const acc: MediaItem[] = [];
      const seen = new Set<string>();
      let start = 0;
      let userName: string | undefined;
      let total = 0;
      let note: string | undefined;
      let fatal: string | undefined;

      try {
        for (;;) {
          const r = await chunkMut.mutateAsync({
            doubanId: id,
            cookie,
            category: cat,
            start,
          });
          if (!r.ok) {
            if (acc.length === 0) fatal = r.error ?? "抓取失败";
            else note = r.error;
            break;
          }
          userName ??= r.userName;
          if (r.total) total = r.total;
          const fresh = r.items.filter((i) => !seen.has(i.subjectId));
          fresh.forEach((i) => {
            seen.add(i.subjectId);
            acc.push(i);
          });
          setLive((p) => ({ ...p, [cat]: { fetched: acc.length, total } }));
          if (r.error) note = r.error;
          if (r.done) break;
          start = r.nextStart;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "请求失败";
        if (acc.length === 0) fatal = msg;
        else note = msg;
      }

      const hiddenNote =
        !note && total > acc.length
          ? `匿名访问有 ${total - acc.length} 条被豆瓣隐藏（受限条目需登录可见，可填 Cookie 补全）`
          : undefined;

      setResults((prev) => ({
        ...prev,
        [cat]: fatal
          ? { category: cat, ok: false, total, fetched: 0, items: [], error: fatal }
          : {
              category: cat,
              ok: true,
              userName,
              total,
              fetched: acc.length,
              items: acc,
              error: note ?? hiddenNote,
            },
      }));
    }
    setCurrentCat(null);
    setStage("done");
    setSearchParams({ id }, { replace: true });
  };

  // 抓取完成后写入 localStorage 缓存
  useEffect(() => {
    if (stage !== "done" || !doubanId) return;
    const hasData = CATEGORY_ORDER.some((c) => (results[c]?.fetched ?? 0) > 0);
    if (!hasData || savedAt) return;
    const name =
      CATEGORY_ORDER.map((c) => results[c]?.userName).find(Boolean) ?? doubanId;
    const total = CATEGORY_ORDER.reduce((s, c) => s + (results[c]?.fetched ?? 0), 0);
    const rec = {
      version: 1 as const,
      doubanId,
      userName: name,
      results,
      savedAt: Date.now(),
    };
    if (saveRecord(rec)) setSavedAt(rec.savedAt);
    pushRecent({ doubanId, userName: name, savedAt: rec.savedAt, total });
    setRecents(loadRecent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, results]);

  // 启动：分享链接 / 缓存直达
  useEffect(() => {
    const param = searchParams.get("id");
    const cached = loadRecord();
    setRecents(loadRecent());
    if (cached) setCachedId(cached.doubanId);
    if (param) {
      if (cached && cached.doubanId === param) loadFromCache(cached);
      else scrape(param);
    } else if (cached) {
      // 分析记录直达：打开即进入分析页
      loadFromCache(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setStage("idle");
    setResults({});
    setLive({});
    setSavedAt(null);
    setDoubanId("");
    setSearchParams({}, { replace: true });
    const cached = loadRecord();
    if (cached) setCachedId(cached.doubanId);
  };

  const openRecent = (entry: RecentEntry) => {
    const cached = loadRecord();
    if (cached && cached.doubanId === entry.doubanId) loadFromCache(cached);
    else scrape(entry.doubanId);
  };

  const userName = useMemo(() => {
    for (const cat of CATEGORY_ORDER) {
      const r = results[cat];
      if (r?.userName) return r.userName;
    }
    return doubanId;
  }, [results, doubanId]);

  const stats = useMemo(
    () =>
      CATEGORY_ORDER.filter((c) => results[c]?.ok).map((c) =>
        computeStats(c, results[c]!.items, results[c]!.total),
      ),
    [results],
  );

  const okCount = CATEGORY_ORDER.filter((c) => results[c]?.ok).length;
  const hasAnyItem = stats.some((s) => s.fetched > 0);
  const items = useMemo(() => allItems(results), [results]);
  const hasMovies = (results.movie?.fetched ?? 0) > 0;
  const allEmpty =
    stage === "done" &&
    !hasAnyItem &&
    CATEGORY_ORDER.every((c) => results[c] && !results[c]!.error && results[c]!.total === 0);

  const tabCls =
    "gap-1.5 rounded-full text-zinc-400 transition-all data-[state=active]:bg-emerald-500 data-[state=active]:text-emerald-950 data-[state=active]:font-medium";

  return (
    <div className="noise min-h-screen bg-[#09090b] text-zinc-100">
      {/* 背景：网格 + 光晕 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div className="pointer-events-none fixed -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

      {/* 吸顶玻璃导航 */}
      <header className="glass sticky top-0 z-40 border-b border-zinc-800/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <button onClick={reset} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-emerald-950">
              豆
            </div>
            <span className="font-display text-sm font-medium tracking-wide text-zinc-200">
              Douban Lens
            </span>
            <span className="hidden text-xs text-zinc-600 sm:inline">豆瓣档案分析</span>
          </button>
          {stage === "done" && hasAnyItem && (
            <div className="flex items-center gap-2">
              {savedAt && (
                <span className="hidden items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-500 md:flex">
                  <Clock3 className="h-3 w-3" />
                  缓存于 {formatSavedAt(savedAt)}
                </span>
              )}
              <ShareDialog userName={userName} doubanId={doubanId} results={results} />
              <button
                onClick={() => scrape(doubanId)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-emerald-600 hover:text-emerald-400"
                title="重新抓取最新数据"
              >
                <RefreshCcw className="h-3 w-3" />
                重新分析
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-emerald-600 hover:text-emerald-400"
              >
                <RotateCcw className="h-3 w-3" />
                换个 ID
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 pb-20">
        {stage === "idle" && (
          <div className="pb-16 pt-20 text-center md:pt-28">
            <div className="anim-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              书影音三合一 · 基于豆瓣公开档案
            </div>
            <h1 className="anim-fade-up anim-delay-1 mx-auto max-w-4xl font-display text-5xl font-bold leading-[1.08] tracking-tight md:text-7xl">
              一个 ID，
              <br />
              看穿 TA 的
              <span className="text-shimmer">书影音宇宙</span>
            </h1>
            <p className="anim-fade-up anim-delay-2 mx-auto mt-6 max-w-xl text-sm leading-relaxed text-zinc-500 md:text-base">
              拉取全部「看过 / 读过 / 听过」，可筛选浏览，
              <br className="hidden md:block" />
              自动生成评分、类型、地区、年度报告与 AI 深度解读。
            </p>
            <div className="anim-fade-up anim-delay-3 mt-10">
              <ScrapeForm loading={false} defaultId={cachedId} onSubmit={scrape} />
            </div>

            {/* 最近分析记录 */}
            {recents.length > 0 && (
              <div className="anim-fade-up anim-delay-4 mt-6 flex flex-wrap items-center justify-center gap-2">
                <span className="flex items-center gap-1 text-xs text-zinc-600">
                  <History className="h-3 w-3" />
                  最近分析
                </span>
                {recents.slice(0, 4).map((r) => (
                  <button
                    key={r.doubanId}
                    onClick={() => openRecent(r)}
                    className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs text-zinc-400 transition-all hover:-translate-y-0.5 hover:border-emerald-600/60 hover:text-emerald-300"
                  >
                    {r.userName}
                    <span className="ml-1.5 text-zinc-600">{r.total} 条</span>
                  </button>
                ))}
              </div>
            )}

            {/* 特性跑马灯 */}
            <div className="anim-fade-in anim-delay-5 relative mt-20 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
              <div
                className="flex w-max gap-3"
                style={{ animation: "marquee-x 30s linear infinite" }}
              >
                {[...FEATURES, ...FEATURES].map((f, i) => (
                  <span
                    key={i}
                    className="whitespace-nowrap rounded-full border border-zinc-800/80 bg-zinc-900/40 px-5 py-2 text-xs text-zinc-500"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage !== "idle" && (
          <div className="pt-8">
            {/* 抓取进度 */}
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {CATEGORY_ORDER.map((cat, idx) => {
                const Icon = CATEGORY_ICON[cat];
                const r = results[cat];
                const isLoading = stage === "loading" && currentCat === cat;
                const liveInfo = live[cat];
                return (
                  <div
                    key={cat}
                    className={`anim-fade-up anim-delay-${idx + 1} rounded-2xl border p-4 transition-colors ${
                      isLoading
                        ? "border-emerald-700/60 bg-emerald-950/20"
                        : "border-zinc-800/80 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Icon className="h-4 w-4 text-zinc-500" />
                        {CATEGORY_LABEL[cat]}
                      </div>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      ) : r ? (
                        r.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )
                      ) : (
                        <span className="text-xs text-zinc-600">等待</span>
                      )}
                    </div>
                    <div className="num mt-2 text-2xl font-bold">
                      {isLoading ? (
                        <>
                          <span className="text-emerald-400">{liveInfo?.fetched ?? 0}</span>
                          {liveInfo?.total ? (
                            <span className="text-base font-normal text-zinc-500">
                              /{liveInfo.total}
                            </span>
                          ) : null}
                          <span className="ml-1 text-xs font-normal text-zinc-500">
                            条 · 抓取中
                          </span>
                        </>
                      ) : r ? (
                        r.ok ? (
                          <>
                            {r.fetched}
                            {r.total > r.fetched && (
                              <span className="text-base font-normal text-zinc-500">
                                /{r.total}
                              </span>
                            )}
                            <span className="ml-1 text-xs font-normal text-zinc-500">条</span>
                          </>
                        ) : (
                          <span className="text-base text-red-400">失败</span>
                        )
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </div>
                    {isLoading && liveInfo?.total ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (liveInfo.fetched / Math.max(liveInfo.total, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                    {r?.error && (
                      <p className={`mt-1 text-[11px] leading-snug ${r.ok ? "text-amber-500/80" : "text-red-400/80"}`}>
                        {r.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {stage === "done" && !hasAnyItem && (
              <div className="anim-fade-up rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-10 text-center">
                {allEmpty ? (
                  <>
                    <p className="text-zinc-300">该用户暂无公开的书影音标记</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      可能是档案设为私密，或确实没有标记过内容
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300">未能获取到数据</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      请检查豆瓣 ID 是否正确、对方档案是否公开；被风控时可在高级选项填入自己的豆瓣 Cookie
                    </p>
                  </>
                )}
                <button
                  onClick={reset}
                  className="btn-glow mt-5 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
                >
                  换个 ID 试试
                </button>
              </div>
            )}

            {stage === "done" && hasAnyItem && (
              <div className="anim-fade-up anim-delay-2">
                <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  <span className="text-shimmer">{userName}</span>
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    的书影音档案（{stats.reduce((s, x) => s + x.fetched, 0)} 条）
                  </span>
                </h2>
                <Tabs defaultValue="overview">
                  <TabsList className="mb-6 h-auto flex-wrap justify-start gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 p-1.5">
                    <TabsTrigger value="overview" className={tabCls}>
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      总览
                    </TabsTrigger>
                    {CATEGORY_ORDER.filter((c) => (results[c]?.fetched ?? 0) > 0).map((c) => {
                      const Icon = CATEGORY_ICON[c];
                      return (
                        <TabsTrigger key={c} value={c} className={tabCls}>
                          <Icon className="h-3.5 w-3.5" />
                          {CATEGORY_LABEL[c]}
                        </TabsTrigger>
                      );
                    })}
                    {hasMovies && (
                      <TabsTrigger value="preference" className={tabCls}>
                        <Heart className="h-3.5 w-3.5" />
                        观影偏好
                      </TabsTrigger>
                    )}
                    {hasMovies && (
                      <TabsTrigger value="region" className={tabCls}>
                        <Globe2 className="h-3.5 w-3.5" />
                        地区报告
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="year" className={tabCls}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      年度报告
                    </TabsTrigger>
                    <TabsTrigger value="report" className={tabCls}>
                      <FileText className="h-3.5 w-3.5" />
                      分析报告
                    </TabsTrigger>
                  </TabsList>

                  <div className="tab-anim">
                    <TabsContent value="overview">
                      <Overview results={results} stats={stats} />
                    </TabsContent>
                    {CATEGORY_ORDER.filter((c) => (results[c]?.fetched ?? 0) > 0).map((c) => (
                      <TabsContent key={c} value={c}>
                        <ItemExplorer items={results[c]!.items} />
                      </TabsContent>
                    ))}
                    {hasMovies && (
                      <TabsContent value="preference">
                        <MoviePreference items={items} />
                      </TabsContent>
                    )}
                    {hasMovies && (
                      <TabsContent value="region">
                        <RegionReport items={items} />
                      </TabsContent>
                    )}
                    <TabsContent value="year">
                      <YearReport items={items} />
                    </TabsContent>
                    <TabsContent value="report">
                      <ReportPanel
                        userName={userName}
                        doubanId={doubanId}
                        results={results}
                        stats={stats}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
                {okCount < CATEGORY_ORDER.length && (
                  <p className="mt-4 text-xs text-zinc-600">
                    部分类别抓取失败或被限流，数据可能不完整；填 Cookie 后重新查询可提高成功率。
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="mt-20 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-700">
          数据来自豆瓣公开档案页 · 仅供个人学习娱乐使用 · 与豆瓣官方无关
        </footer>
      </div>
    </div>
  );
}
