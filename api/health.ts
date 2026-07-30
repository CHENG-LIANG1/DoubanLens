import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  maxDuration: 10,
};

export default function health(
  _request: IncomingMessage,
  response: ServerResponse,
): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      ok: true,
      service: "douban-lens-api",
    }),
  );
}
