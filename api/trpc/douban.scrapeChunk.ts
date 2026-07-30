import { getRequestListener } from "@hono/node-server";
import app from "../app";

export const config = {
  maxDuration: 60,
};

// Vercel 此项目使用 Node 函数运行时；交给 Hono 官方适配器转换请求。
export default getRequestListener(app.fetch);
