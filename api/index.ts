import { getRequestListener } from "@hono/node-server";
import app from "./app";

export const config = {
  maxDuration: 60,
};

// 单一 Vercel Node Function 承接所有 /api/* 请求。
export default getRequestListener(app.fetch);
