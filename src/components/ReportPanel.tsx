import { useMemo, useState } from "react";
import { Copy, Download, Loader2, Sparkles } from "lucide-react";
import type { Category, CategoryResult } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { buildAiPayload, buildLocalReport, type CategoryStats } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "./Markdown";

export function ReportPanel({
  userName,
  doubanId,
  results,
  stats,
}: {
  userName: string;
  doubanId: string;
  results: Partial<Record<Category, CategoryResult | null>>;
  stats: CategoryStats[];
}) {
  const localReport = useMemo(
    () => buildLocalReport({ userName, doubanId, results, stats }),
    [userName, doubanId, results, stats],
  );

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.moonshot.cn/v1");
  const [model, setModel] = useState("kimi-k2-0905-preview");
  const [aiMarkdown, setAiMarkdown] = useState("");
  const [aiError, setAiError] = useState("");

  const analyze = trpc.douban.analyze.useMutation({
    onSuccess: (r) => {
      setAiMarkdown(r.markdown);
      setAiError("");
    },
    onError: (e) => setAiError(e.message),
  });

  const runAi = () => {
    if (!apiKey.trim() || analyze.isPending) return;
    setAiError("");
    analyze.mutate({
      userName,
      doubanId,
      payload: buildAiPayload(results, stats),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || "https://api.moonshot.cn/v1",
      model: model.trim() || "kimi-k2-0905-preview",
    });
  };

  const fullReport = aiMarkdown
    ? `${localReport}\n\n---\n\n# AI 深度解读\n\n${aiMarkdown}`
    : localReport;

  const download = () => {
    const blob = new Blob([fullReport], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${userName}-豆瓣书影音档案分析.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullReport);
  };

  return (
    <div className="space-y-5">
      {/* AI 解读配置 */}
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-300">
          <Sparkles className="h-4 w-4" />
          AI 深度解读（可选）
        </div>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          填入任意 OpenAI 兼容接口的 Key（默认 Kimi
          开放平台），统计数据与清单样本会脱敏后发送给模型，生成个性化口味解读与推荐。Key
          不会被存储。
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL"
            className="h-9 bg-zinc-900/80 border-zinc-700 text-xs"
          />
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="模型名"
            className="h-9 bg-zinc-900/80 border-zinc-700 text-xs"
          />
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="API Key（sk-...）"
            className="h-9 bg-zinc-900/80 border-zinc-700 text-xs"
          />
          <Button
            onClick={runAi}
            disabled={!apiKey.trim() || analyze.isPending}
            className="h-9 text-sm btn-glow bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {analyze.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                生成中…
              </>
            ) : (
              "生成 AI 解读"
            )}
          </Button>
        </div>
        {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
      </div>

      {/* 导出操作 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={download}
          className="btn-secondary"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          下载 Markdown{aiMarkdown ? "（含 AI 解读）" : ""}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          className="btn-secondary"
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          复制全文
        </Button>
        <span className="text-xs text-zinc-600">下载后可自行打印或另存为 PDF</span>
      </div>

      {/* 报告正文 */}
      <div
        id="report-root"
        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8"
      >
        <Markdown>{localReport}</Markdown>
        {aiMarkdown && (
          <>
            <div className="my-8 border-t border-zinc-800" />
            <h1 className="mb-4 mt-2 text-2xl font-bold text-zinc-100">AI 深度解读</h1>
            <Markdown>{aiMarkdown}</Markdown>
          </>
        )}
      </div>
    </div>
  );
}
