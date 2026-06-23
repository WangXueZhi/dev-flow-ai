const ignoredHeadings = new Set([
  "acceptance criteria",
  "api docs",
  "commands",
  "components",
  "constraints",
  "data models",
  "design asset",
  "design assets",
  "endpoint",
  "endpoints",
  "environment variables",
  "error cases",
  "future web ui",
  "goal",
  "layout",
  "output style",
  "request shape",
  "requirements",
  "responsive behavior",
  "response shape",
  "screens",
  "states",
  "ui notes",
  "user stories"
]);

export function extractMarkdownSignals(markdown: string, limit = 8): string[] {
  const signals = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/.test(line) || /^#+\s+\S/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^#+\s+/, ""))
    .filter((line) => !/^\[[ xX]\]\s+/.test(line))
    .filter((line) => !line.includes("Describe "))
    .filter((line) => !ignoredHeadings.has(line.toLowerCase()));

  return [...new Set(signals)].slice(0, limit);
}

export function extractChecklistItems(markdown: string, limit = 12): string[] {
  const items = markdown
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.match(/^[-*]\s+\[[ xX]\]\s+(.+)$/)?.[1])
    .filter((line): line is string => Boolean(line));

  return [...new Set(items)].slice(0, limit);
}
