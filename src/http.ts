import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server";
import type { ExecuteContext } from "./core/execute";

export async function serveHttp(ctx: ExecuteContext, port: number, host = "127.0.0.1"): Promise<void> {
  const mcp = createServer(ctx);

  const http = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname === "/health") {
        json(res, 200, { ok: true, name: "agy-slack" });
        return;
      }
      if (url.pathname !== "/mcp") {
        json(res, 404, { error: "not_found" });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await mcp.connect(transport);

      if (req.method === "GET" || req.method === "DELETE") {
        await transport.handleRequest(req, res);
        return;
      }

      if (req.method === "POST") {
        const body = await readJson(req);
        await transport.handleRequest(req, res, body);
        return;
      }

      json(res, 405, { error: "method_not_allowed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) json(res, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    http.listen(port, host, () => resolve());
    http.on("error", reject);
  });

  process.stderr.write(`agy-slack listening on http://${host}:${port}/mcp\n`);
}

function json(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
