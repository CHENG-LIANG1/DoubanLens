import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  ExternalLink,
  Hand,
  Loader2,
  LocateFixed,
  Search,
  Star,
  X,
} from "lucide-react";
import type { MediaItem } from "@contracts/types";
import { REGION_ADMIN, REGION_COORDS } from "@/lib/geo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  /** 占全部已定位电影的百分比 */
  share: number;
  /** 1-5 星各自数量 */
  dist: number[];
  /** 最近标记的一部 */
  latest: MediaItem;
  /** 按评分降序、日期降序 */
  movies: MediaItem[];
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 悬浮详情卡（HUD 风，渲染进 globe tooltip 容器，只能内联样式） */
function labelHtml(p: RegionPoint): string {
  const maxD = Math.max(...p.dist, 1);
  const distBar = p.dist
    .map((c, i) => {
      const h = Math.max(2, Math.round((c / maxD) * 20));
      const color = i >= 3 ? "#34d399" : i === 2 ? "#52525b" : "#3f3f46";
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;height:30px;">
        <div style="width:100%;height:${h}px;border-radius:2px;background:${color};opacity:${c ? 1 : 0.3};"></div>
        <span style="font-size:8px;color:#71717a;letter-spacing:0.5px;">${i + 1}★</span>
      </div>`;
    })
    .join("");

  const topRows = p.movies
    .slice(0, 5)
    .map((m, i) => {
      const stars =
        m.rating > 0
          ? `<span style="color:#fbbf24;">${"★".repeat(m.rating)}</span>`
          : `<span style="color:#52525b;">未评分</span>`;
      const year = m.year
        ? ` <span style="color:#52525b;">· ${m.year}</span>`
        : "";
      return `<div style="display:flex;align-items:center;gap:8px;padding:2.5px 0;font-size:12px;line-height:1.5;">
        <span style="font-family:ui-monospace,monospace;font-size:10px;color:#34d399;opacity:0.75;width:14px;flex-shrink:0;">0${i + 1}</span>
        <span style="color:#e4e4e7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${esc(m.mainTitle || m.title)}${year}</span>
        <span style="flex-shrink:0;font-size:11px;">${stars}</span>
      </div>`;
    })
    .join("");

  const latest = p.latest;
  const divider = `<div style="border-top:1px dashed rgba(52,211,153,0.2);margin:8px 0;"></div>`;

  return `<div style="min-width:290px;max-width:330px;padding:14px 16px 12px;border-radius:4px;background:rgba(6,10,9,0.94);border:1px solid rgba(52,211,153,0.4);box-shadow:0 0 0 1px rgba(52,211,153,0.08),0 16px 48px rgba(0,0,0,0.7);backdrop-filter:blur(10px);text-align:left;position:relative;">
    <div style="position:absolute;top:-1px;left:-1px;width:10px;height:10px;border-top:2px solid #34d399;border-left:2px solid #34d399;"></div>
    <div style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-bottom:2px solid #34d399;border-right:2px solid #34d399;"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 10px #34d399;flex-shrink:0;"></span>
      <span style="font-size:15px;font-weight:600;color:#fafafa;">${esc(p.name)}</span>
      <span style="margin-left:auto;font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:#34d399;">${p.count} 部 · ${p.share.toFixed(1)}%</span>
    </div>
    <div style="font-size:11px;color:#a1a1aa;letter-spacing:0.3px;">
      ${p.avg != null ? `均分 <b style="color:#d4d4d8;">${p.avg.toFixed(2)}</b> · ` : ""}${p.five > 0 ? `五星 <b style="color:#d4d4d8;">${p.five}</b> 部` : "暂无五星"}
    </div>
    <div style="display:flex;gap:3px;align-items:flex-end;margin:8px 0 2px;">${distBar}</div>
    ${divider}
    <div style="font-family:ui-monospace,monospace;font-size:9px;color:#34d399;opacity:0.7;letter-spacing:2px;margin-bottom:4px;">TOP RATED</div>
    ${topRows}
    ${divider}
    <div style="font-size:11px;color:#a1a1aa;display:flex;justify-content:space-between;gap:10px;">
      <span style="color:#71717a;flex-shrink:0;">最新标记</span>
      <span style="color:#d4d4d8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(latest.mainTitle || latest.title)}</span>
      <span style="font-family:ui-monospace,monospace;color:#71717a;flex-shrink:0;">${latest.date.slice(5)}</span>
    </div>
    <div style="margin-top:9px;font-size:11px;color:#34d399;letter-spacing:1px;">▸ 点击查看全部 ${p.count} 部片单</div>
  </div>`;
}

const asPoint = (o: object) => o as RegionPoint;

/**
 * GeoJSON feature 附加 data.region。
 * 渲染访问器与交互回调（label/hover/click）收到的参数最终都是
 * 带 data 字段的 feature 本体（three-globe digest 会再包一层，globe.gl 解包后取出）
 */
type GeoFeat = object & { data?: { region: string | null } };
const featRegion = (f: object | null | undefined) =>
  (f as GeoFeat | null | undefined)?.data?.region ?? null;

function pointColor(d: RegionPoint, max: number): string {
  const r = d.count / max;
  if (r >= 0.5) return "#6ee7b7";
  if (r >= 0.2) return "#34d399";
  return "#10b981";
}

const fmtLat = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? "N" : "S"}`;
const fmtLng = (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? "E" : "W"}`;

export function RegionGlobe({ items }: { items: MediaItem[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [size, setSize] = useState({ w: 0, h: 560 });
  const [selected, setSelected] = useState<RegionPoint | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [focusRegion, setFocusRegion] = useState<string | null>(null);
  const [features, setFeatures] = useState<object[]>([]);
  const [kw, setKw] = useState("");

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
    let located = 0;
    map.forEach((movies, name) => {
      const coord = REGION_COORDS[name];
      if (!coord) {
        missing += movies.length;
        return;
      }
      located += movies.length;
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
        dist: [1, 2, 3, 4, 5].map((s) => rated.filter((m) => m.rating === s).length),
        latest: [...movies].sort((a, b) => b.date.localeCompare(a.date))[0],
        share: 0, // 回填
        movies,
      });
    });
    pts.forEach((p) => {
      p.share = located ? Math.round((p.count / located) * 1000) / 10 : 0;
    });
    pts.sort((a, b) => b.count - a.count);
    return {
      points: pts,
      unlocated: missing,
      locatedCount: located,
    };
  }, [items]);

  const pointByName = useMemo(
    () => new Map(points.map((p) => [p.name, p])),
    [points],
  );
  const maxCount = points[0]?.count ?? 1;

  /** GeoJSON ADMIN → 部数最多的中文地区名（如 China → 中国大陆） */
  const adminToRegion = useMemo(() => {
    const m = new Map<string, { region: string; count: number }>();
    points.forEach((p) => {
      const admin = REGION_ADMIN[p.name];
      if (!admin) return;
      const cur = m.get(admin);
      if (!cur || p.count > cur.count) m.set(admin, { region: p.name, count: p.count });
    });
    const out = new Map<string, string>();
    m.forEach((v, k) => out.set(k, v.region));
    return out;
  }, [points]);

  /** 加载国家边界 */
  useEffect(() => {
    let dead = false;
    fetch("/data/countries.geojson")
      .then((r) => r.json())
      .then((j) => {
        if (!dead && Array.isArray(j.features)) setFeatures(j.features);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  /** 附加 data.region 供 polygon 访问器使用 */
  const polygons = useMemo(
    () =>
      features.map((f) => ({
        ...(f as Record<string, unknown>),
        data: {
          region:
            adminToRegion.get(
              (f as { properties?: { ADMIN?: string } }).properties?.ADMIN ?? "",
            ) ?? null,
        },
      })),
    [features, adminToRegion],
  );

  /** 当前激活地区（hover 优先，其次定位） */
  const activeRegion = hoverRegion ?? focusRegion;
  const activePoint = activeRegion ? pointByName.get(activeRegion) : undefined;

  /**
   * focusRegion 的最新值镜像到 ref：
   * 自转恢复 timer 的回调必须读最新值——useEffect 闭包快照可能过期，
   * 否则会出现在定位飞行后自转被过期 timer 偷偷恢复的竞态
   */
  const focusRegionRef = useRef<string | null>(null);
  focusRegionRef.current = focusRegion;

  /** 容器自适应 */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setSize({ w: Math.floor(w), h: w < 640 ? 430 : 580 });
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

  /** hover 时暂停自转（看清详情），移开 1.8s 后恢复（回调读 ref 判最新状态） */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    if (hoverRegion) {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer.current);
    } else {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => {
        if (!focusRegionRef.current) controls.autoRotate = true;
      }, 1800);
    }
  }, [hoverRegion, focusRegion]);

  /** 初始化相机与自转；拖拽时暂停，松手 2.5s 后恢复 */
  const handleGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    /** 调试实例（E2E 用） */
    (window as unknown as Record<string, unknown>).__doubanGlobe = g;
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
        if (!focusRegionRef.current) controls.autoRotate = true;
      }, 2500);
    });
    g.pointOfView({ lat: 30, lng: 105, altitude: 2.55 }, 0);
  };

  /** 相机飞行定位到地区色块 */
  const flyTo = useCallback(
    (name: string) => {
      const g = globeRef.current;
      const p = pointByName.get(name);
      if (!g || !p) return;
      setFocusRegion(name);
      const controls = g.controls();
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer.current);
      g.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.5 }, 1150);
      resumeTimer.current = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 10000);
    },
    [pointByName],
  );

  const resetView = useCallback(() => {
    setFocusRegion(null);
    const g = globeRef.current;
    if (!g) return;
    window.clearTimeout(resumeTimer.current);
    g.pointOfView({ lat: 30, lng: 105, altitude: 2.55 }, 1150);
    resumeTimer.current = window.setTimeout(() => {
      g.controls().autoRotate = true;
    }, 2500);
  }, []);

  /** 搜索匹配的电影 */
  const allMovies = useMemo(
    () => items.filter((i) => i.category === "movie"),
    [items],
  );
  const matches = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return [];
    return allMovies
      .filter(
        (m) =>
          m.mainTitle.toLowerCase().includes(k) ||
          m.title.toLowerCase().includes(k),
      )
      .slice(0, 8);
  }, [kw, allMovies]);

  const locateMovie = (m: MediaItem) => {
    setKw("");
    const region = m.regions?.find((r) => pointByName.has(r));
    if (region) flyTo(region);
  };

  const chipCls = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
      active
        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
        : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-300"
    }`;

  return (
    <div className="space-y-5">
      {/* —— 主打 HUD 大卡 —— */}
      <div className="bento hud-grid scanline anim-fade-up relative overflow-hidden rounded-2xl border-emerald-500/20">
        {/* 四角准星 */}
        <span className="pointer-events-none absolute left-2 top-2 z-20 h-4 w-4 border-l-2 border-t-2 border-emerald-400/80" />
        <span className="pointer-events-none absolute right-2 top-2 z-20 h-4 w-4 border-r-2 border-t-2 border-emerald-400/80" />
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 h-4 w-4 border-b-2 border-l-2 border-emerald-400/80" />
        <span className="pointer-events-none absolute bottom-2 right-2 z-20 h-4 w-4 border-b-2 border-r-2 border-emerald-400/80" />

        {/* 顶部状态栏 */}
        <div className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-emerald-500/15 bg-zinc-950/70 px-4 py-3">
          <Crosshair className="h-4 w-4 text-emerald-400" />
          <span className="font-display text-sm font-semibold tracking-[0.25em] text-emerald-300">
            GLOBAL FOOTPRINT
          </span>
          <span className="text-xs text-zinc-500">足迹地球 · 观影版图扫描</span>
          <div className="ml-auto flex items-center gap-2 font-display text-[11px] tracking-wider">
            <span className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-0.5 text-zinc-400">
              REGIONS <b className="text-emerald-400">{points.length}</b>
            </span>
            <span className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-0.5 text-zinc-400">
              FILMS <b className="text-emerald-400">{locatedCount}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              <i className="hud-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE
            </span>
          </div>
        </div>

        {/* 搜索 + 地区筛选条 */}
        <div className="relative z-20 flex flex-col gap-2.5 border-b border-zinc-800/60 bg-zinc-950/40 px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索电影，定位到地区…"
              className="h-8 border-zinc-800 bg-zinc-900/70 pl-8 text-xs placeholder:text-zinc-600 focus-visible:ring-emerald-500/40"
            />
            {kw.trim() && (
              <div className="absolute left-0 right-0 top-9 z-30 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur">
                {matches.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-zinc-600">
                    没有匹配的电影
                  </p>
                ) : (
                  matches.map((m) => (
                    <button
                      key={m.subjectId}
                      onClick={() => locateMovie(m)}
                      className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition hover:bg-emerald-500/10"
                    >
                      <div className="h-8 w-6 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
                        <CoverImage
                          src={m.cover}
                          alt={m.mainTitle || m.title}
                          className="h-full w-full"
                        />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-zinc-200">
                          {m.mainTitle || m.title}
                        </span>
                        <span className="block truncate text-[10px] text-zinc-500">
                          {m.year ? `${m.year} · ` : ""}
                          {m.regions?.join(" / ") || "未知地区"}
                        </span>
                      </span>
                      <LocateFixed className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 font-display text-[10px] tracking-widest text-zinc-600">
              FILTER ▸
            </span>
            {points.slice(0, 14).map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  focusRegion === p.name ? resetView() : flyTo(p.name)
                }
                className={chipCls(focusRegion === p.name)}
              >
                {p.name}
                <span className="font-display text-[10px] opacity-70">
                  {p.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 地球画布 */}
        <div ref={wrapRef} className="relative z-0">
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
                showGraticules
                onGlobeReady={handleGlobeReady}
                /* 地区色块层 */
                polygonsData={polygons}
                polygonGeoJsonGeometry="geometry"
                polygonCapColor={(f: object) => {
                  const r = featRegion(f);
                  if (r && r === activeRegion) return "rgba(52, 211, 153, 0.85)";
                  if (r) return "rgba(16, 185, 129, 0.2)";
                  return "rgba(148, 163, 184, 0.02)";
                }}
                polygonSideColor={(f: object) =>
                  featRegion(f)
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(0, 0, 0, 0)"
                }
                polygonStrokeColor={(f: object) => {
                  const r = featRegion(f);
                  if (r && r === activeRegion) return "#a7f3d0";
                  if (r) return "rgba(52, 211, 153, 0.45)";
                  return "rgba(255, 255, 255, 0.05)";
                }}
                polygonAltitude={(f: object) => {
                  const r = featRegion(f);
                  if (r && r === activeRegion) return 0.045;
                  if (r) return 0.012;
                  return 0.004;
                }}
                polygonsTransitionDuration={300}
                polygonLabel={(d: object) => {
                  const r = featRegion(d);
                  const p = r ? pointByName.get(r) : undefined;
                  return p ? labelHtml(p) : "";
                }}
                onPolygonHover={(d: object | null) =>
                  setHoverRegion(featRegion(d))
                }
                onPolygonClick={(d: object) => {
                  const r = featRegion(d);
                  const p = r ? pointByName.get(r) : undefined;
                  if (p) setSelected(p);
                }}
                /* 点位层 */
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
                onPointHover={(d: object | null) =>
                  setHoverRegion(d ? asPoint(d).name : null)
                }
                onPointClick={(d: object) => setSelected(asPoint(d))}
                /* 波纹层 */
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

          {/* 定位状态面板 */}
          {focusRegion && activePoint && (
            <div className="anim-fade-in absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-zinc-950/85 py-1.5 pl-2.5 pr-1.5 backdrop-blur">
              <LocateFixed className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-zinc-200">
                已定位 <b className="text-emerald-300">{focusRegion}</b>
                <span className="ml-1.5 font-display text-[10px] text-zinc-500">
                  {activePoint.count} 部
                </span>
              </span>
              <button
                onClick={() => setSelected(activePoint)}
                className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300 transition hover:bg-emerald-500/30"
              >
                查看片单
              </button>
              <button
                onClick={resetView}
                className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="清除定位"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* 坐标读出 */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden font-display text-[10px] tracking-[0.2em] text-emerald-500/60 sm:block">
            {activePoint
              ? `▸ LAT ${fmtLat(activePoint.lat)} · LNG ${fmtLng(activePoint.lng)} · ${activePoint.name}`
              : "▸ SCANNING…"}
          </div>

          {size.w > 0 && (
            <div className="pointer-events-none absolute bottom-3 right-3 z-20 hidden items-center gap-1.5 font-display text-[10px] tracking-wider text-zinc-600 sm:flex">
              DRAG 旋转 / SCROLL 缩放 / HOVER 详情 / CLICK 片单
            </div>
          )}
          {size.w > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-700/50 bg-zinc-950/70 px-3 py-1 text-[11px] text-zinc-400 backdrop-blur sm:hidden">
              <Hand className="h-3 w-3" />
              单指旋转 · 双指缩放 · 点按看片单
            </div>
          )}
        </div>
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
                    {` · 占比 ${selected.share.toFixed(1)}%`}
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
