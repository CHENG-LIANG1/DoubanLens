import { useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ScrapeForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (doubanId: string, cookie?: string) => void;
}) {
  const [id, setId] = useState("");
  const [cookie, setCookie] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const submit = () => {
    const v = id.trim();
    if (!v || loading) return;
    onSubmit(v, cookie.trim() || undefined);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <Input
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="输入豆瓣 ID，如 62759792 或 ahbei"
          className="h-13 flex-1 bg-zinc-900/80 border-zinc-700 text-lg px-5 placeholder:text-zinc-600 focus-visible:ring-emerald-500/50"
        />
        <Button
          onClick={submit}
          disabled={loading || !id.trim()}
          className="h-13 px-7 text-base bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              抓取中
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              开始分析
            </>
          )}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
        />
        高级选项：遇到风控 / 私密条目时填入自己的豆瓣 Cookie（可选）
      </button>
      {showAdvanced && (
        <div className="mt-2">
          <Textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder='例如：bid=xxxx; ck=xxxx; dbcl2="..."（浏览器 F12 → Network → 任意豆瓣请求 → 复制 Cookie 头）'
            className="bg-zinc-900/80 border-zinc-700 text-xs text-zinc-400 min-h-20 placeholder:text-zinc-600"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            Cookie 仅作为请求转发使用，不会被存储。填入后可抓取受限条目并大幅降低被风控概率。
          </p>
        </div>
      )}
    </div>
  );
}
