import app from "../app";

// 使用 Vercel 原生 Fetch Handler，不经过 Node req/res 适配层。
export const config = {
  maxDuration: 60,
};

export default app;
