import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import app from "./app";

export const config = {
  maxDuration: 60,
};

// 保持入口本身零运行时依赖，避免依赖初始化失败时整只函数直接崩溃。
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if ((request.url ?? "").startsWith("/api/health")) {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({ ok: true, service: "douban-lens-api" }),
    );
    return;
  }

  try {
    await getRequestListener(app.fetch)(request, response);
  } catch (error) {
    console.error("API initialization failed", error);
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: "API initialization failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
