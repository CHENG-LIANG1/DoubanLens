import { handle } from "hono/vercel";
import app from "./app";

// Vercel Serverless Function 入口：/api/* 全部转发到 Hono 应用
export const config = {
  maxDuration: 60,
};

export default handle(app);
