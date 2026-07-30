import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "./app";
import scrapeFunction from "./trpc/douban.scrapeChunk";
import analyzeFunction from "./trpc/douban.analyze";
import imageFunction from "./img";

describe("Vercel API routing", () => {
  it("returns tRPC JSON instead of an HTML platform 404", async () => {
    const response = await app.request(
      "/api/trpc/douban.scrapeChunk?batch=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          0: {
            json: {
              doubanId: "x",
              category: "movie",
              start: 0,
            },
          },
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toBeTypeOf("object");
  });

  it("uses explicit Vercel functions for every browser API endpoint", () => {
    const config = JSON.parse(
      readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
    ) as {
      rewrites?: Array<{ source: string; destination: string }>;
      functions?: Record<string, unknown>;
    };

    expect(config.rewrites).not.toContainEqual(
      expect.objectContaining({ source: "/api/:path*" }),
    );
    // 函数时限由各入口的 `export const config` 声明，避免集中配置
    // 与 Vercel 的文件发现结果不一致而使整个 deployment 构建失败。
    expect(config.functions).toBeUndefined();
  });

  it("exports native Fetch handlers without a req/res adapter", () => {
    expect(scrapeFunction).toBeTypeOf("function");
    expect(analyzeFunction).toBeTypeOf("function");
    expect(imageFunction).toBeTypeOf("function");
  });
});
