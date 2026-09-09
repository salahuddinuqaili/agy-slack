import { PROMPTS } from "./catalog";

export function listPrompts() {
  return PROMPTS;
}

export function getPrompt(name: string, args: Record<string, string | undefined>) {
  const def = PROMPTS.find((p) => p.name === name);
  if (!def) throw new Error(`Unknown prompt ${name}`);
  const channel = args.channel ?? (name === "incident_brief" ? "#incidents" : "#eng");
  const query = args.query ?? args.permalink ?? "";
  const text = promptText(name, { channel, query, permalink: args.permalink });
  return {
    name,
    title: def.title,
    description: def.description,
    messages: [
      {
        role: "user" as const,
        content: { type: "text" as const, text },
      },
    ],
  };
}

function promptText(
  name: string,
  args: { channel: string; query: string; permalink?: string },
): string {
  switch (name) {
    case "catch_up":
      return `Catch me up on Slack${args.channel ? ` in ${args.channel}` : ""}.
Use slack_unreads first, then slack_read on anything that looks like a decision or incident.
Return: what changed, who owns it, and what (if anything) I should reply to. Do not send messages.`;
    case "standup":
      return `Draft my standup from ${args.channel} and DMs since yesterday.
Use slack_read since=yesterday and slack_unreads.
Format:
- yesterday
- today
- blockers
Keep bullets short. Do not send.`;
    case "find_decision":
      return `Find the decision about: ${args.query}
Use slack_search, then slack_read on the winning thread.
Quote the decision, the date, and who made it. Do not send.`;
    case "draft_reply":
      return `Read ${args.permalink ?? args.query} with slack_read.
Draft a reply in the channel's voice: calm, specific, no fluff.
Show the draft. Do not send unless I explicitly ask.`;
    case "incident_brief":
      return `Build an incident brief from ${args.channel} since today.
Use slack_read and pins.
Return: timeline, current status, owner, open questions. Do not page anyone and do not send.`;
    default:
      return args.query;
  }
}
