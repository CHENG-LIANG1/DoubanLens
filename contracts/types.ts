export * from "./errors";

/** 书/影/音 三个类别 */
export type Category = "movie" | "book" | "music";

/** 单条「看过/读过/听过」记录 */
export interface MediaItem {
  /** 豆瓣 subject id */
  subjectId: string;
  /** 标题（含原名/译名完整文本） */
  title: string;
  /** 主标题 */
  mainTitle: string;
  /** 条目链接 */
  url: string;
  /** 封面图（grid 模式解析，可能为空） */
  cover?: string;
  /** 类别 */
  category: Category;
  /** 我的评分 1-5（0 = 未评分） */
  rating: number;
  /** 标记日期 YYYY-MM-DD */
  date: string;
  /** 我的短评 */
  comment?: string;
  /** 我的标签 */
  tags: string[];
  /** 原始简介文本（电影 intro / 书籍 pub / 音乐表演者信息） */
  intro?: string;
  /** 上映/出版/发行年份（从 intro 提取，可能为空） */
  year?: number;
  /** 解析出的作者/表演者（书/音乐） */
  creator?: string;
  /** 解析出的类型标签（电影类型匹配，可能为空） */
  genres?: string[];
  /** 解析出的地区（电影，可能为空） */
  regions?: string[];
}

/** 单个类别的抓取结果 */
export interface CategoryResult {
  category: Category;
  ok: boolean;
  /** 页面标题里解析出的用户名 */
  userName?: string;
  /** 页面显示的总数 */
  total: number;
  /** 实际抓到的条目数 */
  fetched: number;
  items: MediaItem[];
  /** 失败原因（被风控 / 私密主页 / 不存在等） */
  error?: string;
}

export interface ScrapeInput {
  doubanId: string;
  /** 可选豆瓣 Cookie（遇到风控时使用） */
  cookie?: string;
}

export interface AnalyzeInput {
  userName: string;
  doubanId: string;
  /** 提供给模型的压缩后的统计与样本数据 */
  payload: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AnalyzeResult {
  markdown: string;
}
