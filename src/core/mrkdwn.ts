/** Slack mrkdwn → compact markdown. Best-effort, not a full parser. */
export function mrkdwnToMarkdown(input: string): string {
  let s = input;
  s = s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
  s = s.replace(/<(https?:[^|>]+)\|([^>]+)>/g, "[$2]($1)");
  s = s.replace(/<(https?:[^>]+)>/g, "$1");
  s = s.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, "#$2");
  s = s.replace(/<!here>/g, "@here");
  s = s.replace(/<!channel>/g, "@channel");
  s = s.replace(/<!everyone>/g, "@everyone");
  s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, "$1**$2**");
  s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, "$1*$2*");
  s = s.replace(/```([\s\S]*?)```/g, "```$1```");
  return s;
}

export function markdownToMrkdwn(input: string): string {
  let s = input;
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "<$2|$1>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  return s;
}

export function slugifyChannel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
