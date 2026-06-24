const ignoredHeadings = new Set([
  "acceptance criteria",
  "api docs",
  "commands",
  "components",
  "constraints",
  "data models",
  "design asset",
  "design assets",
  "design token",
  "design tokens",
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
  "user stories",
  "visual token",
  "visual tokens"
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
  const items: string[] = [];
  const seen = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  let inAcceptanceSection = false;
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/.exec(trimmed);

    if (heading) {
      inAcceptanceSection = isAcceptanceHeading(heading[1] ?? "");
      continue;
    }

    const checkbox = /^[-*]\s+\[[ xX]\]\s+(.+)$/.exec(trimmed)?.[1];
    const candidate = checkbox ?? (inAcceptanceSection ? extractAcceptanceSectionItem(trimmed) : undefined);
    const item = normalizeAcceptanceItem(candidate);

    if (!item) {
      continue;
    }

    const key = item.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(item);

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function isAcceptanceHeading(value: string): boolean {
  return /\b(acceptance criteria|acceptance|success criteria|definition of done|done criteria)\b/i.test(value) ||
    /验收(?:标准|条件|准则)?/.test(value);
}

function extractAcceptanceSectionItem(line: string): string | undefined {
  const bullet = /^[-*]\s+(?!\[[ xX]\]\s+)(.+)$/.exec(line)?.[1];
  if (bullet) {
    return bullet;
  }

  const numbered = /^(?:\d+|[A-Za-z])[.)]\s+(.+)$/.exec(line)?.[1];
  if (numbered) {
    return numbered;
  }

  if (/^(?:Given|When|Then|And|But)\b.+/i.test(line)) {
    return line;
  }

  return extractAcceptanceTableItem(line);
}

function extractAcceptanceTableItem(line: string): string | undefined {
  if (!/^\|.+\|$/.test(line) || /^\|[\s:-]+\|?$/.test(line)) {
    return undefined;
  }

  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  if (cells.length < 2 || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
    return undefined;
  }

  if (cells.some((cell) => /^(id|key|criteria?|acceptance criteria|验收标准)$/i.test(cell))) {
    return undefined;
  }

  return cells[cells.length - 1];
}

function normalizeAcceptanceItem(value: string | undefined): string | undefined {
  const item = value
    ?.replace(/^\[[ xX]\]\s+/, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!item || item.endsWith(":") || item.includes("...")) {
    return undefined;
  }

  return item;
}
