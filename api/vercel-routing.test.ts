import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "./app";
import vercelFunction from "./index";

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

    expect(config.rewrites).toContainEqual(
      {
        source: "/api/:path*",
        destination: "/api/index",
      },
    );
    expect(config.functions).toEqual({
      "api/index.ts": { maxDuration: 60 },
    });
  });

  it("exports one official Hono Node handler", () => {
    expect(vercelFunction).toBeTypeOf("function");
  });

  it("exposes a health route from the same application", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "douban-lens-api",
    });
  });
});
