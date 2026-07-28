import * as cheerio from "cheerio";
import type { Category, MediaItem } from "../../contracts/types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CATEGORY_HOST: Record<Category, string> = {
  movie: "https://movie.douban.com",
  book: "https://book.douban.com",
  music: "https://music.douban.com",
};

/** 单个分块最多抓几页（控制单次请求时长，避免网关超时） */
const PAGES_PER_CHUNK = 3;
/** 全局页数上限（15 条/页） */
const MAX_PAGES = 200;
const PAGE_DELAY_MS = 400;

/** 豆瓣电影官方类型词表，用于从 intro 里精确匹配 */
const MOVIE_GENRES = [
  "剧情", "喜剧", "动作", "爱情", "科幻", "动画", "悬疑", "惊悚", "恐怖",
  "犯罪", "同性", "音乐", "歌舞", "传记", "历史", "战争", "西部", "奇幻",
  "冒险", "灾难", "武侠", "情色", "纪录片", "短片", "家庭", "儿童", "古装",
  "运动", "黑色电影", "真人秀", "脱口秀", "舞台艺术", "戏曲", "曲艺",
];

/** 常见制片地区词表 */
const REGIONS = [
  "中国大陆", "中国香港", "中国台湾", "美国", "日本", "英国", "法国", "德国",
  "韩国", "意大利", "西班牙", "印度", "泰国", "俄罗斯", "加拿大", "澳大利亚",
  "伊朗", "瑞典", "丹麦", "挪威", "芬兰", "荷兰", "比利时", "瑞士", "奥地利",
  "波兰", "捷克", "匈牙利", "墨西哥", "巴西", "阿根廷", "智利", "土耳其",
  "以色列", "爱尔兰", "新西兰", "新加坡", "马来西亚", "印度尼西亚",
  "菲律宾", "越南", "埃及", "南非", "尼日利亚", "苏联", "西德", "南斯拉夫",
  "捷克斯洛伐克", "希腊", "葡萄牙", "罗马尼亚", "保加利亚", "乌克兰",
  "冰岛", "卢森堡", "古巴", "哥伦比亚", "秘鲁", "乌拉圭", "黎巴嫩",
  "巴勒斯坦", "卡塔尔", "阿联酋", "蒙古", "哈萨克斯坦", "尼泊尔",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildHeaders(host: string, cookie?: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: `${host}/`,
    "Cache-Control": "no-cache",
  };
  if (cookie && cookie.trim()) h.Cookie = cookie.trim();
  return h;
}

function pageUrl(category: Category, id: string, start: number): string {
  return `${CATEGORY_HOST[category]}/people/${encodeURIComponent(
    id,
  )}/collect?start=${start}&sort=time&rating=all&filter=all&mode=grid`;
}

function extractRating(cls: string | undefined): number {
  if (!cls) return 0;
  const m = cls.match(/rating(\d)-t/);
  return m ? parseInt(m[1], 10) : 0;
}

function extractYear(text: string): number | undefined {
  const m = text.match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : undefined;
}

function matchKeywords(intro: string, dict: string[]): string[] {
  const found: string[] = [];
  for (const seg of intro.split("/")) {
    const s = seg.trim();
    if (dict.includes(s) && !found.includes(s)) found.push(s);
  }
  return found;
}

function parseTags(text: string): string[] {
  const m = text.replace(/\s+/g, " ").match(/标签[:：]\s*(.+)/);
  if (!m) return [];
  return m[1]
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function detectBlock($: cheerio.CheerioAPI, status: number, html: string): string | null {
  if (status === 403 || status === 418)
    return "豆瓣拒绝了请求（HTTP " + status + "），可能是访问频率风控或需要登录态，可在「高级选项」填入自己的豆瓣 Cookie 后重试";
  if (status === 404) return "未找到该用户的档案页，请检查豆瓣 ID 是否正确";
  if (status !== 200) return `请求失败（HTTP ${status}）`;
  if (html.includes("检测到有异常请求") || html.includes("sec-captcha"))
    return "触发了豆瓣反爬验证（滑块/验证码），请在「高级选项」填入自己的豆瓣 Cookie 后重试";
  if (html.includes("你访问的页面不存在") || $("title").text().includes("不存在"))
    return "页面不存在，请检查豆瓣 ID";
  return null;
}

/** 解析用户名 & 总数，例如「xxx看过的影视(254)」 */
function parseTitleMeta($: cheerio.CheerioAPI): { userName?: string; total: number } {
  const h1 = $("div.info h1").first().text().replace(/\s+/g, " ").trim();
  const totalMatch = h1.match(/\((\d+)\)/);
  let userName: string | undefined;
  const nameMatch = h1.match(/^(.*?)(?:看过|读过|听过|在看|在读|在听|想看|想读|想听)/);
  if (nameMatch) userName = nameMatch[1].trim();
  let total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  if (!total) {
    const num = $("span.subject-num").first().text();
    const m = num.match(/\/\s*(\d+)/);
    if (m) total = parseInt(m[1], 10);
  }
  return { userName, total };
}

/** 电影 & 音乐：grid 模式（grid-view 结构，带封面） */
function parseGridPage($: cheerio.CheerioAPI, category: "movie" | "music"): MediaItem[] {
  const items: MediaItem[] = [];
  $("div.grid-view div.item").each((_, el) => {
    const node = $(el);
    const titleA = node.find("li.title a").first();
    const url = titleA.attr("href") ?? "";
    const idMatch = url.match(/subject\/(\d+)/);
    if (!idMatch) return;
    const em = titleA.find("em").first().text().trim();
    const fullTitle = titleA.text().replace(/\s+/g, " ").trim();
    const intro = node.find("li.intro").first().text().replace(/\s+/g, " ").trim();
    const date = node.find("span.date").first().text().trim();
    const rating = extractRating(node.find("span[class*='rating']").first().attr("class"));
    const comment = node
      .find("li.comment, div.comment, span.comment")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const tags = parseTags(node.find("span.tags, li.tags").first().text());

    let creator: string | undefined;
    let genres: string[] = [];
    let regions: string[] = [];
    if (category === "movie") {
      genres = intro ? matchKeywords(intro, MOVIE_GENRES) : [];
      regions = intro ? matchKeywords(intro, REGIONS) : [];
    } else if (intro) {
      // 音乐 intro：表演者 / 发行日期 / 专辑 / 介质 / 流派
      const segs = intro.split("/").map((s) => s.trim()).filter(Boolean);
      creator = segs[0];
      const last = segs[segs.length - 1];
      if (segs.length >= 2 && last && !/^\d{4}/.test(last) && last !== creator) {
        genres = [last];
      }
    }

    items.push({
      subjectId: idMatch[1],
      title: fullTitle || em,
      mainTitle: em || fullTitle.split("/")[0].trim(),
      url,
      cover: node.find("div.pic img").first().attr("src") || undefined,
      category,
      rating,
      date,
      comment: comment || undefined,
      tags,
      intro: intro || undefined,
      year: intro ? extractYear(intro) : undefined,
      creator,
      genres,
      regions,
    });
  });
  return items;
}

/** 书籍：grid 模式（interest-list 结构） */
function parseBookPage($: cheerio.CheerioAPI): MediaItem[] {
  const items: MediaItem[] = [];
  $("ul.interest-list li.subject-item, ul.subject-list li.subject-item").each((_, el) => {
    const node = $(el);
    const titleA = node.find("h2 a").first();
    const url = titleA.attr("href") ?? "";
    const idMatch = url.match(/subject\/(\d+)/);
    if (!idMatch) return;
    const mainTitle =
      (titleA.attr("title") ?? "").trim() ||
      titleA.clone().children().remove().end().text().replace(/\s+/g, " ").trim();
    const intro = node.find("div.pub").first().text().replace(/\s+/g, " ").trim();
    const rating = extractRating(node.find("span[class*='rating']").first().attr("class"));
    const dateRaw = node.find("span.date").first().text().replace(/\s+/g, " ").trim();
    const date = (dateRaw.match(/\d{4}-\d{1,2}-\d{1,2}/) ?? [""])[0];
    const comment = node.find("p.comment").first().text().replace(/\s+/g, " ").trim();
    const tags = parseTags(node.find("span.tags, div.tags").first().text());
    let creator: string | undefined;
    if (intro) {
      const segs = intro.split("/").map((s) => s.trim());
      creator = segs[0];
    }
    items.push({
      subjectId: idMatch[1],
      title: mainTitle,
      mainTitle,
      url,
      cover: node.find("div.pic img").first().attr("src") || undefined,
      category: "book",
      rating,
      date,
      comment: comment || undefined,
      tags,
      intro: intro || undefined,
      year: intro ? extractYear(intro) : undefined,
      creator,
    });
  });
  return items;
}

function parsePage($: cheerio.CheerioAPI, category: Category): MediaItem[] {
  if (category === "book") return parseBookPage($);
  return parseGridPage($, category);
}

async function fetchHtml(url: string, host: string, cookie?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: buildHeaders(host, cookie),
      signal: controller.signal,
      redirect: "follow",
    });
    const html = await res.text();
    return { status: res.status, html };
  } finally {
    clearTimeout(timer);
  }
}

export interface ChunkResult {
  category: Category;
  ok: boolean;
  userName?: string;
  total: number;
  /** 本块起始 start 值 */
  start: number;
  /** 下一块的 start；done 时无意义 */
  nextStart: number;
  /** 是否已全部抓完（或触及上限/被拦截） */
  done: boolean;
  items: MediaItem[];
  /** 致命错误（ok=false 时）或提示性信息（部分隐藏/触及上限等） */
  error?: string;
}

/**
 * 分批抓取：每次最多 PAGES_PER_CHUNK 页，前端循环调用直至 done。
 */
export async function scrapeChunk(
  category: Category,
  doubanId: string,
  start: number,
  cookie?: string,
): Promise<ChunkResult> {
  const host = CATEGORY_HOST[category];
  const items: MediaItem[] = [];
  let userName: string | undefined;
  let total = 0;
  const base: Omit<ChunkResult, "ok" | "items" | "nextStart" | "done"> = {
    category,
    total: 0,
    start,
  };

  // 第一页（含元信息解析与风控检测）
  const first = await fetchHtml(pageUrl(category, doubanId, start), host, cookie);
  const $first = cheerio.load(first.html);
  const blockErr = detectBlock($first, first.status, first.html);
  if (blockErr) {
    return { ...base, ok: false, nextStart: start, done: true, items: [], error: blockErr };
  }
  if (start === 0) {
    const meta = parseTitleMeta($first);
    userName = meta.userName;
    total = meta.total;
  }
  const firstItems = parsePage($first, category);
  items.push(...firstItems);

  // start=0 时若标题显示有数量却一条都解析不到，视为私密/异常
  if (start === 0 && total > 0 && firstItems.length === 0) {
    return {
      ...base,
      ok: false,
      userName,
      total,
      nextStart: start,
      done: true,
      items: [],
      error: "页面可访问但未解析到条目，该用户的档案可能设为私密",
    };
  }

  let nextStart = start + 15;
  let emptyStreak = firstItems.length === 0 ? 1 : 0;
  let blockedNote: string | undefined;

  // 继续抓本块剩余页
  for (let p = 1; p < PAGES_PER_CHUNK; p++) {
    const cur = start + p * 15;
    if (total > 0 && cur >= total) break;
    if (cur >= MAX_PAGES * 15) break;
    await sleep(PAGE_DELAY_MS);
    const { status, html } = await fetchHtml(pageUrl(category, doubanId, cur), host, cookie);
    if (status !== 200) {
      blockedNote = `第 ${cur / 15 + 1} 页起被豆瓣拦截（HTTP ${status}），仅获取到已抓取部分`;
      nextStart = cur;
      break;
    }
    const $ = cheerio.load(html);
    const pageItems = parsePage($, category);
    if (pageItems.length === 0) {
      emptyStreak += 1;
    } else {
      emptyStreak = 0;
      items.push(...pageItems);
    }
    nextStart = cur + 15;
    if (emptyStreak >= 2) break;
  }

  if (blockedNote) {
    return {
      ...base,
      ok: true,
      userName,
      total,
      nextStart,
      done: true,
      items,
      error: blockedNote,
    };
  }

  const done =
    emptyStreak >= 2 ||
    (total > 0 && nextStart >= total) ||
    nextStart >= MAX_PAGES * 15;

  let note: string | undefined;
  if (done && nextStart >= MAX_PAGES * 15 && (total === 0 || nextStart < total)) {
    note = `条目过多，仅抓取前 ${MAX_PAGES * 15} 条`;
  }

  return { ...base, ok: true, userName, total, nextStart, done, items, error: note };
}
