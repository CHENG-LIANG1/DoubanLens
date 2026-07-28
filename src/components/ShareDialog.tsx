import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";
import type { Category, CategoryResult, MediaItem } from "@contracts/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SharePoster, type PosterData } from "./SharePoster";

export function ShareDialog({
  userName,
  doubanId,
  results,
}: {
  userName: string;
  doubanId: string;
  results: Partial<Record<Category, CategoryResult | null>>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const shareUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.search = `?id=${encodeURIComponent(doubanId)}`;
    return u.toString();
  }, [doubanId]);

  const posterData: PosterData = useMemo(() => {
    const items = (Object.values(results).filter(Boolean) as CategoryResult[]).flatMap(
      (r) => r.items,
    );
    const rated = items.filter((i) => i.rating > 0);
    const genreCounter = new Map<string, number>();
    const regionCounter = new Map<string, number>();
    items.forEach((i) => {
      i.genres?.forEach((g) => genreCounter.set(g, (genreCounter.get(g) ?? 0) + 1));
      i.regions?.forEach((r) => regionCounter.set(r, (regionCounter.get(r) ?? 0) + 1));
    });
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const covers = items
      .filter((i: MediaItem) => i.cover && i.rating >= 4)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
    return {
      userName,
      doubanId,
      counts: {
        movie: results.movie?.fetched ?? 0,
        book: results.book?.fetched ?? 0,
        music: results.music?.fetched ?? 0,
      },
      avgRating: rated.length
        ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(2)
        : null,
      fiveCount: rated.filter((i) => i.rating === 5).length,
      totalItems: items.length,
      topGenres: top(genreCounter),
      topRegions: top(regionCounter),
      covers,
      shareUrl,
    };
  }, [results, userName, doubanId, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 忽略剪贴板权限失败 */
    }
  };

  const downloadPoster = async () => {
    if (!posterRef.current || downloading) return;
    setDownloading(true);
    try {
      // 等海报内图片加载
      const imgs = posterRef.current.querySelectorAll("img");
      await Promise.all(
        [...imgs].map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) return resolve(null);
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }),
        ),
      );
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: false });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${userName}-豆瓣书影音报告.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="btn-secondary text-emerald-300/90"
        >
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          分享
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>分享这份档案分析</DialogTitle>
          <DialogDescription className="text-zinc-500">
            好友打开链接即可看到同款分析（会实时重新抓取公开数据）
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            readOnly
            value={shareUrl}
            className="h-9 flex-1 bg-zinc-900 border-zinc-700 text-xs text-zinc-400"
            onFocus={(e) => e.target.select()}
          />
          <Button
            size="sm"
            onClick={copyLink}
            className="h-9 btn-glow bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                已复制
              </>
            ) : (
              <>
                <Link2 className="mr-1 h-3.5 w-3.5" />
                复制
              </>
            )}
          </Button>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 海报预览（缩放显示） */}
        <div className="flex justify-center">
          <div
            className="overflow-hidden rounded-xl border border-zinc-800 shadow-2xl"
            style={{ width: 300, height: 420 }}
          >
            <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>
              <SharePoster data={posterData} />
            </div>
          </div>
        </div>

        <Button
          onClick={downloadPoster}
          disabled={downloading}
          className="w-full btn-glow bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
        >
          {downloading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              下载分享海报 PNG
            </>
          )}
        </Button>

        {/* 隐藏的全尺寸海报（截图目标） */}
        <div className="pointer-events-none fixed -left-[2000px] top-0" aria-hidden>
          <SharePoster ref={posterRef} data={posterData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
