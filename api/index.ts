import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

// Vercel Serverless Function 入口：/api/* 全部转发到 Hono 应用
// 使用经典 (req, res) 签名 + 手写适配器，兼容性最好
export const config = {
  maxDuration: 60,
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const host = req.headers.host ?? "localhost";
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const url = `${proto}://${host}${req.url ?? "/"}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else if (typeof value === "string") headers.set(key, value);
    }

    const method = (req.method ?? "GET").toUpperCase();
    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      const body = await readBody(req);
      if (body.length > 0) init.body = body;
    }

    const response = await app.fetch(new Request(url, init));

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") res.setHeader(key, value);
    });
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "function error",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
