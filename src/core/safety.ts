import type { ServerConfig, SlackChannel, ToolDef } from "./types";
import { getTool } from "./catalog";
import { channelAllowed } from "./resolve";

export interface Confirmation {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview: string;
  createdAt: number;
}

const pending = new Map<string, Confirmation>();

export function gateWrite(opts: {
  tool: string;
  args: Record<string, unknown>;
  config: ServerConfig;
  channel?: SlackChannel;
  preview: string;
}): { blocked?: string; confirm?: Confirmation } | undefined {
  const def = getTool(opts.tool);
  if (!def?.write) return undefined;

  if (opts.channel) {
    const allow = channelAllowed(opts.channel, opts.config.allowChannels, opts.config.denyChannels);
    if (!allow.ok) return { blocked: allow.reason };
  }

  if (opts.config.mode === "readonly") {
    return {
      blocked: `Write blocked: SLACK_MCP_MODE=readonly (${opts.tool}). Set SLACK_MCP_MODE=confirm or write to enable.`,
    };
  }

  const confirmed = opts.args.confirm === true || opts.args.confirm === "true";
  if (opts.config.mode === "confirm" && !confirmed) {
    const id = makeId();
    const confirmation: Confirmation = {
      id,
      tool: opts.tool,
      args: { ...opts.args, confirm: true },
      preview: opts.preview,
      createdAt: Date.now(),
    };
    pending.set(id, confirmation);
    return { confirm: confirmation };
  }
  return undefined;
}

export function formatConfirmation(c: Confirmation): string {
  return [
    "Write preview — nothing was sent.",
    "",
    c.preview,
    "",
    `Re-call ${c.tool} with confirm=true to execute.`,
    `confirmation_id: ${c.id}`,
  ].join("\n");
}

export function isWriteTool(name: string): boolean {
  return Boolean(getTool(name)?.write);
}

export function assertPinsWrite(def: ToolDef | undefined, action: string): boolean {
  if (!def) return false;
  if (def.name !== "slack_pins") return def.write;
  return action === "add" || action === "remove";
}

function makeId(): string {
  return `cfm_${Math.random().toString(36).slice(2, 10)}`;
}
