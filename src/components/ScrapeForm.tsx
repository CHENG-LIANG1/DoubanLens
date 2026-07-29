import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ScrapeForm({
  loading,
  defaultId = "",
  onSubmit,
}: {
  loading: boolean;
  defaultId?: string;
  onSubmit: (doubanId: string, cookie?: string) => void;
}) {
  const [id, setId] = useState(defaultId);
  const [cookie, setCookie] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const submit = () => {
    const v = id.trim();
    if (!v || loading) return;
    onSubmit(v, cookie.trim() || undefined);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 玻璃输入框 */}
      <div className="glass rounded-2xl border border-zinc-800 p-2 shadow-2xl shadow-emerald-950/30 transition-colors focus-within:border-emerald-700/70">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="输入豆瓣 ID，如 62759792 或 ahbei"
            className="h-12 flex-1 border-0 bg-transparent px-4 text-base placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            onClick={submit}
            disabled={loading || !id.trim()}
            className="btn-glow h-12 rounded-xl bg-emerald-500 px-7 text-base font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                抓取中
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                开始分析
              </>
            )}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-3 mx-auto flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-300 ${showAdvanced ? "rotate-180" : ""}`}
        />
        高级选项：遇到风控 / 私密条目时填入自己的豆瓣 Cookie（可选）
      </button>
      {showAdvanced && (
        <div className="mt-2 anim-fade-up">
          <Textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder='例如：bid=xxxx; ck=xxxx; dbcl2="..."（浏览器 F12 → Network → 任意豆瓣请求 → 复制 Cookie 头）'
            className="bg-zinc-900/80 border-zinc-800 text-xs text-zinc-400 min-h-20 placeholder:text-zinc-700 focus-visible:ring-emerald-500/40"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            Cookie 仅作为请求转发使用，不会被存储。填入后可抓取受限条目并大幅降低被风控概率。
          </p>
        </div>
      )}
    </div>
  );
}
