import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { scrapeChunk } from "./douban/scraper";
import type { AnalyzeResult } from "../contracts/types";

const scrapeInput = z.object({
  doubanId: z
    .string()
    .trim()
    .min(2, "豆瓣 ID 太短")
    .max(64)
    .regex(/^[\w.\-一-龥]+$/, "豆瓣 ID 格式不正确"),
  cookie: z.string().trim().max(4000).optional(),
  category: z.enum(["movie", "book", "music"]),
  /** 分页游标（每页 15 条） */
  start: z.number().int().min(0).max(100000).default(0),
});

const analyzeInput = z.object({
  userName: z.string().max(64),
  doubanId: z.string().max(64),
  payload: z.string().max(60000),
  apiKey: z.string().trim().min(8, "请填写 API Key").max(512),
  baseUrl: z
    .string()
    .trim()
    .url()
    .max(256)
    .default("https://api.moonshot.cn/v1"),
  model: z.string().trim().min(2).max(128).default("kimi-k2-0905-preview"),
});

export const doubanRouter = createRouter({
  scrapeChunk: publicQuery
    .input(scrapeInput)
    .mutation(({ input }) =>
      scrapeChunk(input.category, input.doubanId, input.start, input.cookie),
    ),

  analyze: publicQuery
    .input(analyzeInput)
    .mutation(async ({ input }): Promise<AnalyzeResult> => {
      const base = input.baseUrl.replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: input.model,
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "你是一位资深的书影音评论人与数据分析师。用户会给你一份某个豆瓣用户的「看过电影 / 读过书籍 / 听过音乐」的统计数据与样本清单（来自其豆瓣公开档案）。请基于这些数据写一份**详细、有洞察、具体**的中文分析报告，要求：\n" +
                  "1. 用 Markdown 输出，包含小标题、必要的列表与表格；\n" +
                  "2. 必须引用数据中的具体片名/书名/专辑名作为论据，禁止空泛的套话；\n" +
                  "3. 分析维度建议：总体画像与口味关键词、观影偏好（类型/地区/年代/评分习惯）、阅读偏好（作者/题材/深度）、音乐偏好、品味演变轨迹（结合标记时间）、交叉洞察（如书影联动、科幻迷等）、以及 6-10 条「你可能也会喜欢」的个性化推荐（附理由）；\n" +
                  "4. 语气像一个了解他的朋友写的观察笔记，犀利有趣但尊重；\n" +
                  "5. 篇幅 1500 字以上。",
              },
              {
                role: "user",
                content: `豆瓣用户：${input.userName}（ID: ${input.doubanId}）\n以下是其书影音档案的统计数据与样本：\n\n${input.payload}`,
              },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `模型接口返回 ${res.status}：${text.slice(0, 300)}，请检查 API Key / 模型名 / Base URL`,
          );
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const markdown = json.choices?.[0]?.message?.content ?? "";
        if (!markdown) throw new Error("模型返回为空");
        return { markdown };
      } finally {
        clearTimeout(timer);
      }
    }),
});
