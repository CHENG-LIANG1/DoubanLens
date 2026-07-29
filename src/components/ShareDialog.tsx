import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";
import type { Category, CategoryResult } from "@contracts/types";
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
import { ShareLongImage } from "./ShareLongImage";

export function ShareDialog({
  userName,
  doubanId,
  results,
  trigger,
}: {
  userName: string;
  doubanId: string;
  results: Partial<Record<Category, CategoryResult | null>>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qr, setQr] = useState("");
  const [previewH, setPreviewH] = useState(480);
  const longRef = useRef<HTMLDivElement>(null);
  const SCALE = 0.5;

  const shareUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.search = `?id=${encodeURIComponent(doubanId)}`;
    return u.toString();
  }, [doubanId]);

  useLayoutEffect(() => {
    if (!open) return;
    // 测量隐藏的全尺寸长图高度，计算缩放后的精确容器高度
    const t = setTimeout(() => {
      if (longRef.current) setPreviewH(Math.ceil(longRef.current.offsetHeight * SCALE) + 4);
    }, 50);
    return () => clearTimeout(t);
  }, [open, qr]);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(shareUrl, {
      width: 152,
      margin: 1,
      color: { dark: "#d4d4d8", light: "#00000000" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 忽略剪贴板权限失败 */
    }
  };

  const downloadLong = async () => {
    if (!longRef.current || downloading) return;
    setDownloading(true);
    try {
      const node = longRef.current;
      const imgs = node.querySelectorAll("img");
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
      // 控制总像素，避免超高图在部分浏览器爆掉
      const h = node.offsetHeight;
      const pixelRatio = Math.max(1, Math.min(2, Math.floor((9000 / h) * 10) / 10));
      const dataUrl = await toPng(node, { pixelRatio, cacheBust: false });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${userName}-豆瓣书影音长图.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="btn-glow bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            分享长图
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>分享这份书影音宇宙</DialogTitle>
          <DialogDescription className="text-zinc-500">
            生成内容超全的长图，或复制链接让好友实时生成同款分析
          </DialogDescription>
        </DialogHeader>

        {/* 长图预览 */}
        <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div
            className="overflow-y-auto overflow-x-hidden rounded-lg"
            style={{ width: 640 * SCALE + 8, height: Math.min(previewH, 420) }}
          >
            <div style={{ height: previewH, width: 640 * SCALE }}>
              <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: 640 }}>
                <ShareLongImage
                  userName={userName}
                  doubanId={doubanId}
                  results={results}
                  qr={qr}
                  shareUrl={shareUrl}
                />
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={downloadLong}
          disabled={downloading}
          className="btn-glow w-full bg-emerald-500 font-medium text-emerald-950 hover:bg-emerald-400"
        >
          {downloading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              下载分享长图 PNG
            </>
          )}
        </Button>

        <Separator className="bg-zinc-800" />

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={shareUrl}
            className="h-9 flex-1 bg-zinc-900 border-zinc-700 text-xs text-zinc-400"
            onFocus={(e) => e.target.select()}
          />
          <Button size="sm" onClick={copyLink} className="btn-secondary h-9 bg-transparent">
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                已复制
              </>
            ) : (
              <>
                <Link2 className="mr-1 h-3.5 w-3.5" />
                复制链接
              </>
            )}
          </Button>
        </div>

        {/* 隐藏的全尺寸长图（截图目标） */}
        <div className="pointer-events-none fixed -left-[3000px] top-0" aria-hidden>
          <ShareLongImage
            ref={longRef}
            userName={userName}
            doubanId={doubanId}
            results={results}
            qr={qr}
            shareUrl={shareUrl}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
