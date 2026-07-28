import { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Category, MediaItem } from "@contracts/types";
import { CATEGORY_LABEL } from "@/lib/stats";

export interface PosterData {
  userName: string;
  doubanId: string;
  counts: Record<Category, number>;
  avgRating: string | null;
  fiveCount: number;
  totalItems: number;
  topGenres: string[];
  topRegions: string[];
  covers: MediaItem[];
  shareUrl: string;
}

/** 600×840 分享海报（html-to-image 截图目标，封面强制走同源代理避免跨域） */
export const SharePoster = forwardRef<HTMLDivElement, { data: PosterData }>(
  function SharePoster({ data }, ref) {
    const [qr, setQr] = useState("");
    useEffect(() => {
      QRCode.toDataURL(data.shareUrl, {
        width: 96,
        margin: 1,
        color: { dark: "#d4d4d8", light: "#00000000" },
      })
        .then(setQr)
        .catch(() => setQr(""));
    }, [data.shareUrl]);

    const today = new Date().toLocaleDateString("zh-CN");

    return (
      <div
        ref={ref}
        className="relative flex flex-col overflow-hidden bg-zinc-950 p-8 text-zinc-100"
        style={{ width: 600, height: 840, fontFamily: "system-ui, sans-serif" }}
      >
        {/* 背景 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52,211,153,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.07) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-emerald-600/20 blur-3xl" />

        {/* 头部 */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">
            豆
          </div>
          <div>
            <div className="text-sm font-medium tracking-widest text-emerald-400">
              DOUBAN LENS
            </div>
            <div className="text-xs text-zinc-500">豆瓣书影音档案分析</div>
          </div>
          <div className="ml-auto text-xs text-zinc-600">{today}</div>
        </div>

        {/* 标题 */}
        <div className="relative mt-8">
          <div className="text-4xl font-bold leading-tight">
            <span className="text-emerald-400">{data.userName}</span>
            <span className="text-zinc-100"> 的</span>
          </div>
          <div className="mt-1 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-4xl font-bold text-transparent">
            书影音宇宙
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            豆瓣 ID：{data.doubanId} · 共标记 {data.totalItems} 条
          </div>
        </div>

        {/* 数据三格 */}
        <div className="relative mt-7 grid grid-cols-3 gap-3">
          {(["movie", "book", "music"] as Category[]).map((c) => (
            <div
              key={c}
              className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3"
            >
              <div className="text-xs text-zinc-500">{CATEGORY_LABEL[c]}</div>
              <div className="mt-1 text-3xl font-bold text-zinc-100">
                {data.counts[c]}
              </div>
            </div>
          ))}
        </div>

        {/* 评分条 */}
        <div className="relative mt-3 flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3">
          <div className="text-xs text-emerald-400/80">综合平均评分</div>
          <div className="text-2xl font-bold text-emerald-300">
            {data.avgRating ?? "—"}
            <span className="ml-2 text-xs font-normal text-emerald-500/70">
              五星 {data.fiveCount} 条
            </span>
          </div>
        </div>

        {/* 标签 */}
        {(data.topGenres.length > 0 || data.topRegions.length > 0) && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {data.topGenres.slice(0, 4).map((g) => (
              <span
                key={g}
                className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300"
              >
                {g}
              </span>
            ))}
            {data.topRegions.slice(0, 3).map((r) => (
              <span
                key={r}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* 封面墙 */}
        {data.covers.length > 0 && (
          <div className="relative mt-6 grid grid-cols-6 gap-2">
            {data.covers.slice(0, 6).map((i) => (
              <div
                key={i.category + i.subjectId}
                className="aspect-[2/3] overflow-hidden rounded-md border border-zinc-800"
              >
                <img
                  src={`/api/img?url=${encodeURIComponent(i.cover ?? "")}`}
                  alt={i.mainTitle}
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
            ))}
          </div>
        )}

        {/* 底部 */}
        <div className="relative mt-auto flex items-end justify-between pt-6">
          <div className="text-xs leading-relaxed text-zinc-500">
            <div>输入豆瓣 ID，生成同款报告</div>
            <div className="mt-1 max-w-[380px] truncate text-zinc-600">
              {data.shareUrl.replace(/^https?:\/\//, "")}
            </div>
          </div>
          {qr && <img src={qr} alt="QR" className="h-20 w-20 rounded-md" />}
        </div>
      </div>
    );
  },
);
