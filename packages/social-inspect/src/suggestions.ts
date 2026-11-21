import type { Issue } from "./types";

export interface AgentBriefInput {
  url?: string | undefined;
  issues: Issue[];
}

/**
 * Assemble every outstanding fix into one paste-ready instruction. It stays
 * plain markdown so a human can read the same text they are handing to an
 * agent.
 */
export function buildAgentBrief({ url, issues }: AgentBriefInput): string {
  if (issues.length === 0) {
    return "No social metadata changes needed — all checks pass.";
  }

  const lines = [
    `Fix the social metadata for ${url ?? "this page"}.`,
    "",
    `There are ${issues.length} outstanding ${issues.length === 1 ? "item" : "items"}. ` +
      "Work through them in order, then verify the tags appear in the server-rendered HTML.",
    "",
  ];

  issues.forEach((issue, index) => {
    lines.push(`${index + 1}. ${issue.name} (${issue.code}, ${issue.level})`);
    lines.push(`   Why: ${issue.description}`);
    lines.push("   Add this to <head>:");
    for (const line of issue.html.split("\n")) lines.push(`   ${line}`);
    lines.push(`   Instruction: ${issue.prompt}`);
    lines.push("");
  });

  lines.push("Verify by re-fetching the page and checking that every tag above is present.");
  return lines.join("\n");
}
