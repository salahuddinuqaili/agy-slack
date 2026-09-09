import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodTypeAny } from "zod";
import { TOOLS, SERVER_NAME, SERVER_VERSION } from "./core/catalog";
import type { ToolArg } from "./core/types";
import { executeTool, type ExecuteContext } from "./core/execute";
import { listPrompts, getPrompt } from "./core/prompts";
import { formatChannelList, formatWhoami } from "./core/format";

export function createServer(ctx: ExecuteContext): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: argsToZod(tool.args),
        annotations: {
          title: tool.title,
          readOnlyHint: !tool.write,
          destructiveHint: tool.name === "slack_delete",
          idempotentHint: !tool.write,
          openWorldHint: true,
        },
      },
      async (args) => {
        const result = await executeTool(tool.name, args as Record<string, unknown>, ctx);
        return {
          content: [{ type: "text" as const, text: result.text }],
          isError: result.isError,
          structuredContent: result.structured as Record<string, unknown> | undefined,
        };
      },
    );
  }

  server.registerResource(
    "workspace",
    "slack://workspace",
    {
      title: "Workspace",
      description: "Authenticated workspace + identity",
      mimeType: "text/plain",
    },
    async () => {
      const auth = await ctx.adapter.auth();
      const text = formatWhoami(auth, {
        mode: ctx.config.mode,
        demo: ctx.adapter.tokenSummary().demo,
      });
      return { contents: [{ uri: "slack://workspace", text, mimeType: "text/plain" }] };
    },
  );

  server.registerResource(
    "channels",
    "slack://channels",
    {
      title: "Channels",
      description: "Channel roster",
      mimeType: "text/plain",
    },
    async () => {
      const [channels, users] = await Promise.all([
        ctx.adapter.listChannels(),
        ctx.adapter.listUsers(),
      ]);
      const text = formatChannelList(
        channels.filter((c) => !c.isArchived).slice(0, 80),
        users,
      );
      return { contents: [{ uri: "slack://channels", text, mimeType: "text/plain" }] };
    },
  );

  server.registerResource(
    "unreads",
    "slack://unreads",
    {
      title: "Unreads",
      description: "Unread conversations",
      mimeType: "text/plain",
    },
    async () => {
      const result = await executeTool("slack_unreads", {}, ctx);
      return { contents: [{ uri: "slack://unreads", text: result.text, mimeType: "text/plain" }] };
    },
  );

  server.registerResource(
    "me",
    "slack://me",
    {
      title: "Me",
      description: "Authenticated user",
      mimeType: "text/plain",
    },
    async () => {
      const auth = await ctx.adapter.auth();
      const users = await ctx.adapter.listUsers();
      const me = users.find((u) => u.id === auth.userId);
      const text = me
        ? `${me.displayName} · ${me.realName} · ${me.title ?? ""} · ${me.tz ?? ""}`.trim()
        : auth.user;
      return { contents: [{ uri: "slack://me", text, mimeType: "text/plain" }] };
    },
  );

  for (const prompt of listPrompts()) {
    const schema: Record<string, ZodTypeAny> = {};
    for (const arg of prompt.arguments) {
      schema[arg.name] = arg.required ? z.string() : z.string().optional();
    }
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: schema,
      },
      async (args) => {
        const built = getPrompt(prompt.name, (args ?? {}) as Record<string, string | undefined>);
        return { messages: built.messages };
      },
    );
  }

  return server;
}

function argsToZod(args: ToolArg[]): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const arg of args) {
    let schema: ZodTypeAny;
    if (arg.enum?.length) {
      schema = z.enum(arg.enum as [string, ...string[]]);
    } else if (arg.type === "number") {
      schema = z.number();
    } else if (arg.type === "boolean") {
      schema = z.boolean();
    } else {
      schema = z.string();
    }
    schema = schema.describe(arg.description);
    if (!arg.required) schema = schema.optional();
    shape[arg.name] = schema;
  }
  return shape;
}

export async function serveStdio(ctx: ExecuteContext): Promise<void> {
  const server = createServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
