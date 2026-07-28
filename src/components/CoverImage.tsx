import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** 豆瓣封面：优先直连，失败走后端代理，再失败显示占位 */
export function CoverImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [stage, setStage] = useState(0);

  if (!src || stage >= 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-zinc-800/80 text-zinc-600",
          className,
        )}
      >
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  const url = stage === 0 ? src : `/api/img?url=${encodeURIComponent(src)}`;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("object-cover", className)}
      onError={() => setStage((s) => s + 1)}
    />
  );
}
