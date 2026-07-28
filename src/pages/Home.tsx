import { useMemo, useState } from "react";
import { Book, CheckCircle2, Clapperboard, FileText, LayoutDashboard, Loader2, Music3, RotateCcw, XCircle } from "lucide-react";
import type { Category, CategoryResult } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { CATEGORY_LABEL, computeStats } from "@/lib/stats";
import { ScrapeForm } from "@/components/ScrapeForm";
import { Overview } from "@/components/Overview";
import { ItemExplorer } from "@/components/ItemExplorer";
import { ReportPanel } from "@/components/ReportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stage = "idle" | "loading" | "done";

const CATEGORY_ORDER: Category[] = ["movie", "book", "music"];
const CATEGORY_ICON: Record<Category, typeof Clapperboard> = {
  movie: Clapperboard,
  book: Book,
  music: Music3,
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [doubanId, setDoubanId] = useState("");
  const [results, setResults] = useState<Partial<Record<Category, CategoryResult | null>>>({});
  const [currentCat, setCurrentCat] = useState<Category | null>(null);
  const [fatal, setFatal] = useState("");

  const movieMut = trpc.douban.scrapeMovie.useMutation();
  const bookMut = trpc.douban.scrapeBook.useMutation();
  const musicMut = trpc.douban.scrapeMusic.useMutation();

  const scrape = async (id: string, cookie?: string) => {
    setStage("loading");
    setResults({});
    setFatal("");
    setDoubanId(id);
    const muts: Record<Category, typeof movieMut> = {
      movie: movieMut,
      book: bookMut,
      music: musicMut,
    };
    try {
      for (const cat of CATEGORY_ORDER) {
        setCurrentCat(cat);
        try {
          const r = await muts[cat].mutateAsync({ doubanId: id, cookie });
          setResults((prev) => ({ ...prev, [cat]: r }));
        } catch (e) {
          setResults((prev) => ({
            ...prev,
            [cat]: {
              category: cat,
              ok: false,
              total: 0,
              fetched: 0,
              items: [],
              error: e instanceof Error ? e.message : "请求失败",
            },
          }));
        }
      }
    } finally {
      setCurrentCat(null);
      setStage("done");
    }
  };

  const reset = () => {
    setStage("idle");
    setResults({});
    setDoubanId("");
    setFatal("");
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
      CATEGORY_ORDER.filter((c) => results[c]?.ok)
        .map((c) => computeStats(c, results[c]!.items, results[c]!.total)),
    [results],
  );

  const okCount = CATEGORY_ORDER.filter((c) => results[c]?.ok).length;
  const hasAnyItem = stats.some((s) => s.fetched > 0);
  const allEmpty =
    stage === "done" &&
    !hasAnyItem &&
    CATEGORY_ORDER.every((c) => results[c] && !results[c]!.error && results[c]!.total === 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 背景纹理 */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-emerald-950/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20">
        {/* 头部 */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              豆
            </div>
            <span className="text-sm font-medium tracking-wide text-zinc-300">
              豆瓣档案分析 Douban Lens
            </span>
          </div>
          {stage === "done" && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-emerald-600 hover:text-emerald-400"
            >
              <RotateCcw className="h-3 w-3" />
              重新查询
            </button>
          )}
        </header>

        {stage === "idle" && (
          <div className="pb-10 pt-16 text-center md:pt-24">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-4 py-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              基于豆瓣公开档案 · 书影音三合一
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              一个 ID，看穿 TA 的
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                书影音宇宙
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-500">
              拉取全部「看过 / 读过 / 听过」条目，可筛选浏览，并自动生成含评分分布、类型偏好、
              活跃度与 AI 深度解读的完整分析报告。
            </p>
            <div className="mt-8">
              <ScrapeForm loading={false} onSubmit={scrape} />
            </div>
            <p className="mt-4 text-xs text-zinc-600">
              仅支持公开档案；条目较多时需要 1-2 分钟，请耐心等待
            </p>
          </div>
        )}

        {stage !== "idle" && (
          <div className="pt-6">
            {/* 抓取进度 */}
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {CATEGORY_ORDER.map((cat) => {
                const Icon = CATEGORY_ICON[cat];
                const r = results[cat];
                const isLoading = stage === "loading" && currentCat === cat;
                return (
                  <div
                    key={cat}
                    className={`rounded-xl border p-4 transition-colors ${
                      isLoading
                        ? "border-emerald-700/60 bg-emerald-950/20"
                        : "border-zinc-800 bg-zinc-900/50"
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
                    <div className="mt-2 text-2xl font-bold">
                      {isLoading ? (
                        <span className="text-emerald-400">抓取中…</span>
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
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
                {allEmpty ? (
                  <>
                    <p className="text-zinc-300">该用户暂无公开的书影音标记</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      可能是档案设为私密，或确实没有标记过内容
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300">{fatal || "未能获取到数据"}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      请检查豆瓣 ID 是否正确、对方档案是否公开；被风控时可在高级选项填入自己的豆瓣 Cookie
                    </p>
                  </>
                )}
                <button
                  onClick={reset}
                  className="mt-5 rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white hover:bg-emerald-500"
                >
                  换个 ID 试试
                </button>
              </div>
            )}

            {stage === "done" && hasAnyItem && (
              <>
                <h2 className="mb-4 text-xl font-semibold">
                  <span className="text-emerald-400">{userName}</span>
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    的书影音档案（{stats.reduce((s, x) => s + x.fetched, 0)} 条）
                  </span>
                </h2>
                <Tabs defaultValue="overview">
                  <TabsList className="mb-5 bg-zinc-900/80 border border-zinc-800">
                    <TabsTrigger
                      value="overview"
                      className="gap-1.5 text-zinc-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      总览
                    </TabsTrigger>
                    {CATEGORY_ORDER.filter((c) => (results[c]?.fetched ?? 0) > 0).map((c) => {
                      const Icon = CATEGORY_ICON[c];
                      return (
                        <TabsTrigger
                          key={c}
                          value={c}
                          className="gap-1.5 text-zinc-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {CATEGORY_LABEL[c]}
                        </TabsTrigger>
                      );
                    })}
                    <TabsTrigger
                      value="report"
                      className="gap-1.5 text-zinc-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      分析报告
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <Overview results={results} stats={stats} />
                  </TabsContent>
                  {CATEGORY_ORDER.filter((c) => (results[c]?.fetched ?? 0) > 0).map((c) => (
                    <TabsContent key={c} value={c}>
                      <ItemExplorer items={results[c]!.items} />
                    </TabsContent>
                  ))}
                  <TabsContent value="report">
                    <ReportPanel
                      userName={userName}
                      doubanId={doubanId}
                      results={results}
                      stats={stats}
                    />
                  </TabsContent>
                </Tabs>
                {okCount < CATEGORY_ORDER.length && (
                  <p className="mt-4 text-xs text-zinc-600">
                    部分类别抓取失败或被限流，数据可能不完整；填 Cookie 后重新查询可提高成功率。
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <footer className="mt-16 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-600">
          数据来自豆瓣公开档案页 · 仅供个人学习娱乐使用 · 与豆瓣官方无关
        </footer>
      </div>
    </div>
  );
}
