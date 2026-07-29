import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Hand, Loader2, MapPin, Star } from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { REGION_COORDS } from "@/lib/geo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoverImage } from "./CoverImage";

/** three + globe 体积大，懒加载避免拖累首屏 */
const Globe = lazy(() => import("react-globe.gl"));

interface RegionPoint {
  name: string;
  lat: number;
  lng: number;
  count: number;
  avg: number | null;
  five: number;
  /** 按评分降序、日期降序 */
  movies: MediaItem[];
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 悬浮详情卡（渲染进 globe 的 tooltip 容器，只能内联样式） */
function labelHtml(p: RegionPoint): string {
  const rows = p.movies
    .slice(0, 5)
    .map((m) => {
      const stars =
        m.rating > 0
          ? `<span style="color:#fbbf24;">${"★".repeat(m.rating)}</span>`
          : `<span style="color:#71717a;">未评分</span>`;
      const year = m.year ? ` <span style="color:#71717a;">· ${m.year}</span>` : "";
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:3px 0;font-size:12px;line-height:1.5;">
        <span style="color:#e4e4e7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px;">${esc(m.mainTitle || m.title)}${year}</span>
        <span style="flex-shrink:0;font-size:11px;">${stars}</span>
      </div>`;
    })
    .join("");

  return `<div style="min-width:250px;max-width:310px;padding:14px 16px;border-radius:14px;background:rgba(9,9,11,0.94);border:1px solid rgba(52,211,153,0.35);box-shadow:0 12px 40px rgba(0,0,0,0.65);backdrop-filter:blur(10px);text-align:left;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 10px #34d399;flex-shrink:0;"></span>
      <span style="font-size:15px;font-weight:600;color:#fafafa;">${esc(p.name)}</span>
      <span style="margin-left:auto;font-size:13px;font-weight:700;color:#34d399;">${p.count} 部</span>
    </div>
    <div style="font-size:12px;color:#a1a1aa;margin-bottom:${rows ? 8 : 0}px;">
      ${p.avg != null ? `均分 ${p.avg.toFixed(2)} · ` : ""}${p.five > 0 ? `五星 ${p.five} 部` : "暂无五星"}
    </div>
    ${
      rows
        ? `<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:7px;">${rows}</div>
           <div style="margin-top:8px;font-size:11px;color:#34d399;opacity:0.8;">点击查看全部 ${p.count} 部片单 →</div>`
        : ""
    }
  </div>`;
}

/** react-globe.gl 的访问器签名参数是 object，这里统一收窄 */
const asPoint = (o: object) => o as RegionPoint;

function pointColor(d: RegionPoint, max: number): string {
  const r = d.count / max;
  if (r >= 0.5) return "#6ee7b7";
  if (r >= 0.2) return "#34d399";
  return "#10b981";
}

export function RegionGlobe({ items }: { items: MediaItem[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [size, setSize] = useState({ w: 0, h: 560 });
  const [selected, setSelected] = useState<RegionPoint | null>(null);

  /** 按地区聚合电影 */
  const { points, unlocated, locatedCount } = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    items
      .filter((i) => i.category === "movie" && i.regions && i.regions.length > 0)
      .forEach((m) =>
        m.regions!.forEach((r) => {
          if (!map.has(r)) map.set(r, []);
          map.get(r)!.push(m);
        }),
      );
    const pts: RegionPoint[] = [];
    let missing = 0;
    map.forEach((movies, name) => {
      const coord = REGION_COORDS[name];
      if (!coord) {
        missing += movies.length;
        return;
      }
      movies.sort(
        (a, b) => b.rating - a.rating || b.date.localeCompare(a.date),
      );
      const rated = movies.filter((m) => m.rating > 0);
      pts.push({
        name,
        lat: coord[0],
        lng: coord[1],
        count: movies.length,
        avg: rated.length
          ? Math.round(
              (rated.reduce((s, m) => s + m.rating, 0) / rated.length) * 100,
            ) / 100
          : null,
        five: movies.filter((m) => m.rating === 5).length,
        movies,
      });
    });
    pts.sort((a, b) => b.count - a.count);
    return {
      points: pts,
      unlocated: missing,
      locatedCount: pts.reduce((s, p) => s + p.count, 0),
    };
  }, [items]);

  const maxCount = points[0]?.count ?? 1;

  /** 容器自适应 */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setSize({ w: Math.floor(w), h: w < 640 ? 430 : 560 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  /** 初始化相机与自转；拖拽时暂停，松手 2.5s 后恢复 */
  const handleGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.enableZoom = true;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer.current);
    });
    controls.addEventListener("end", () => {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 2500);
    });
    g.pointOfView({ lat: 30, lng: 105, altitude: 2.55 }, 0);
  };

  return (
    <div className="space-y-5">
      {/* 统计头 */}
      <div className="bento anim-fade-up flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl p-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-zinc-100">
            足迹地球
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            拖拽旋转 · 滚轮缩放 · 悬浮看详情 · 点击看片单
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <MapPin className="h-3 w-3" />
            {points.length} 个国家/地区
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-300">
            {locatedCount} 部电影已落点
          </span>
        </div>
      </div>

      {/* 地球 */}
      <div
        ref={wrapRef}
        className="bento anim-fade-up anim-delay-1 relative overflow-hidden rounded-2xl"
      >
        <Suspense
          fallback={
            <div
              className="flex flex-col items-center justify-center gap-3 text-zinc-500"
              style={{ height: size.h }}
            >
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <span className="text-sm">正在加载 3D 地球…</span>
            </div>
          }
        >
          {size.w > 0 && (
            <Globe
              ref={globeRef}
              width={size.w}
              height={size.h}
              globeImageUrl="/textures/earth-night.jpg"
              bumpImageUrl="/textures/earth-topology.png"
              backgroundImageUrl="/textures/night-sky.png"
              showAtmosphere
              atmosphereColor="#10b981"
              atmosphereAltitude={0.16}
              onGlobeReady={handleGlobeReady}
              pointsData={points}
              pointLat={(d: object) => asPoint(d).lat}
              pointLng={(d: object) => asPoint(d).lng}
              pointColor={(d: object) => pointColor(asPoint(d), maxCount)}
              pointAltitude={(d: object) =>
                0.015 + Math.sqrt(asPoint(d).count / maxCount) * 0.13
              }
              pointRadius={(d: object) =>
                0.22 + Math.sqrt(asPoint(d).count / maxCount) * 0.55
              }
              pointsTransitionDuration={800}
              pointLabel={(d: object) => labelHtml(asPoint(d))}
              onPointClick={(d: object) => setSelected(asPoint(d))}
              ringsData={points}
              ringLat={(d: object) => asPoint(d).lat}
              ringLng={(d: object) => asPoint(d).lng}
              ringColor={() => (t: number) =>
                `rgba(52, 211, 153, ${Math.max(0, 1 - t)})`}
              ringMaxRadius={(d: object) =>
                2 + Math.sqrt(asPoint(d).count / maxCount) * 3.5
              }
              ringPropagationSpeed={0.9}
              ringRepeatPeriod={(d: object) =>
                1700 + (asPoint(d).count % 7) * 240
              }
            />
          )}
        </Suspense>

        {size.w > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-700/50 bg-zinc-950/70 px-3 py-1 text-[11px] text-zinc-400 backdrop-blur sm:hidden">
            <Hand className="h-3 w-3" />
            单指旋转 · 双指缩放
          </div>
        )}
      </div>

      {unlocated > 0 && (
        <p className="text-xs text-zinc-600">
          另有 {unlocated} 部电影的地区信息无法定位，未显示在地球上。
        </p>
      )}

      {/* 地区片单弹窗 */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden border-zinc-800 bg-zinc-950 p-0">
          {selected && (
            <div className="flex max-h-[85vh] flex-col">
              <DialogHeader className="border-b border-zinc-800/80 px-6 py-4">
                <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-xl text-zinc-50">
                    {selected.name}
                  </span>
                  <span className="text-sm font-normal text-emerald-400">
                    {selected.count} 部
                  </span>
                  <span className="text-xs font-normal text-zinc-500">
                    {selected.avg != null && `均分 ${selected.avg.toFixed(2)}`}
                    {selected.five > 0 && ` · 五星 ${selected.five} 部`}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid flex-1 grid-cols-3 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-4 md:grid-cols-5">
                {selected.movies.map((m) => (
                  <a
                    key={m.subjectId}
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800/80">
                      <CoverImage
                        src={m.cover}
                        alt={m.mainTitle || m.title}
                        className="h-full w-full transition duration-300 group-hover:scale-105"
                      />
                      <ExternalLink className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white/0 transition group-hover:text-white/80" />
                    </div>
                    <p className="mt-1.5 truncate text-xs text-zinc-300">
                      {m.mainTitle || m.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                      {m.year && <span>{m.year}</span>}
                      {m.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {m.rating}
                        </span>
                      )}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
