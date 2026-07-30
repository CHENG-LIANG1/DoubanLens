import { getRequestListener } from "@hono/node-server";
import app from "./app";

export const config = {
  maxDuration: 60,
};

export default getRequestListener(app.fetch);
