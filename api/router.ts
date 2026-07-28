import { createRouter, publicQuery } from "./middleware";
import { doubanRouter } from "./doubanRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  douban: doubanRouter,
});

export type AppRouter = typeof appRouter;
