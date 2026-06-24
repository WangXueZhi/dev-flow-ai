import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { PNG } from "pngjs";
import type { ProjectBrief } from "./brief.js";

export interface VisualViewport {
  name: string;
  width: number;
  height: number;
}

export interface VisualReport {
  startedAt: string;
  finishedAt: string;
  url: string;
  status: "passed" | "failed";
  screenshots: VisualScreenshot[];
  layoutIssues: VisualLayoutIssue[];
  requiredText: VisualTextCheck[];
}

export interface VisualScreenshot {
  viewport: VisualViewport;
  path: string;
  title: string;
  bodyCharacters: number;
  analysis: VisualScreenshotAnalysis;
}

export interface VisualScreenshotAnalysis {
  width: number;
  height: number;
  sampledPixels: number;
  distinctPixels: number;
  distinctPixelRatio: number;
  blank: boolean;
}

export interface VisualTextCheck {
  text: string;
  found: boolean;
}

export interface VisualLayoutIssue {
  viewport: VisualViewport;
  type: "horizontal-overflow" | "clipped-text" | "overlap";
  selector: string;
  message: string;
  text?: string;
}

export interface VisualCheckInput {
  url: string;
  outDir: string;
  viewports: VisualViewport[];
  requiredText: string[];
}

export interface ChromiumRuntimeStatus {
  available: boolean;
  executablePath: string;
  installCommand: string;
}

export const defaultViewports: VisualViewport[] = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 900, height: 1100 },
  { name: "mobile", width: 390, height: 844 }
];

export const chromiumInstallCommand = "npx playwright install chromium";

export function inferRequiredTextFromBrief(brief: ProjectBrief, limit = 8): string[] {
  const candidates: string[] = [];
  const requirementText = [
    ...brief.acceptanceCriteria,
    ...brief.signals.requirements,
    ...brief.userStories
  ].join("\n").toLowerCase();

  for (const asset of brief.designAssets) {
    for (const snippet of asset.metadata?.textSnippets ?? []) {
      if (requirementText.includes(snippet.toLowerCase())) {
        candidates.push(snippet);
      }
    }
  }

  for (const criterion of brief.acceptanceCriteria) {
    candidates.push(...extractVisibleTextFromCriterion(criterion));
  }

  for (const item of brief.uiStateChecklist ?? []) {
    if (item.kind !== "state") {
      continue;
    }

    const label = /^([^:]{2,48}):\s+/.exec(item.summary)?.[1];
    if (label) {
      candidates.push(label);
    }
  }

  return uniqueRequiredTextCandidates(candidates, limit);
}

function extractVisibleTextFromCriterion(criterion: string): string[] {
  const candidates: string[] = [];
  const quotePatterns = [
    /`([^`]{2,64})`/g,
    /"([^"]{2,64})"/g,
    /“([^”]{2,64})”/g,
    /'([^']{2,64})'/g,
    /‘([^’]{2,64})’/g,
    /「([^」]{2,64})」/g,
    /『([^』]{2,64})』/g
  ];

  for (const pattern of quotePatterns) {
    for (const match of criterion.matchAll(pattern)) {
      if (match[1]) {
        candidates.push(match[1]);
      }
    }
  }

  const visibilityPattern = /(?:^|[.;。；]\s*)(?:the\s+)?(.{2,96}?)\s+(?:is|are)\s+(?:visible|shown|displayed|present|rendered)\b/gi;
  for (const match of criterion.matchAll(visibilityPattern)) {
    candidates.push(...splitVisibleTextPhrase(match[1] ?? ""));
  }

  const actionPattern = /\b(?:shows?|displays?|renders?)\s+(.{2,96}?)(?:[.;。；]|$)/gi;
  for (const match of criterion.matchAll(actionPattern)) {
    candidates.push(...splitVisibleTextPhrase(match[1] ?? ""));
  }

  const appearsPattern = /(?:^|[.;。；]\s*)(?:the\s+)?(.{2,96}?)\s+appears?\b/gi;
  for (const match of criterion.matchAll(appearsPattern)) {
    candidates.push(...splitVisibleTextPhrase(match[1] ?? ""));
  }

  const localizedVisibilityPattern = /(?:^|[.;。；]\s*)(?:页面|屏幕|界面|视图|组件)?(.{2,96}?)(?:可见|展示|显示|呈现|渲染)(?:[.;。；]|$)/g;
  for (const match of criterion.matchAll(localizedVisibilityPattern)) {
    candidates.push(...splitVisibleTextPhrase(match[1] ?? ""));
  }

  const localizedActionPattern = /(?:展示|显示|呈现|渲染|出现)(.{2,96}?)(?:[.;。；]|$)/g;
  for (const match of criterion.matchAll(localizedActionPattern)) {
    candidates.push(...splitVisibleTextPhrase(match[1] ?? ""));
  }

  return candidates;
}

function splitVisibleTextPhrase(value: string): string[] {
  if (/[`"“”'‘’「」『』]/.test(value)) {
    return [];
  }

  return value
    .replace(/^\s*(?:then|when|given|and|but)\s+/i, "")
    .replace(/^\s*(?:the|a|an)\s+/i, "")
    .replace(/^\s*(?:页面|屏幕|界面|视图|组件|应当|应该|需要|需)\s*/i, "")
    .split(/\s+(?:and|or)\s+|[,，、]|或者|和|或|与/i)
    .map((part) =>
      part
        .replace(/^\s*(?:the|a|an)\s+/i, "")
        .replace(/^\s*(?:页面|屏幕|界面|视图|组件|应当|应该|需要|需)\s*/i, "")
        .trim()
    )
    .filter((part) => !isGenericVisibleTextPhrase(part));
}

function isGenericVisibleTextPhrase(value: string): boolean {
  const normalized = value.toLowerCase();

  return (
    !normalized ||
    /^(?:it|this|that|the page|the screen|the view|the ui|the component|a message|the message)$/.test(normalized) ||
    /^(?:loading|empty|error|success|state|states|desktop|tablet|mobile|viewport|layout)$/.test(normalized) ||
    /^(?:页面|屏幕|界面|视图|组件|消息|提示|状态|首屏|桌面|平板|移动端|布局)$/.test(normalized)
  );
}

export async function runVisualCheck(input: VisualCheckInput): Promise<VisualReport> {
  const startedAt = new Date().toISOString();
  const screenshots: VisualScreenshot[] = [];
  const layoutIssues: VisualLayoutIssue[] = [];
  const textMatches = new Map(input.requiredText.map((text) => [text, false]));

  await mkdir(input.outDir, { recursive: true });

  const chromiumStatus = await getChromiumRuntimeStatus();

  if (!chromiumStatus.available) {
    throw new Error(formatChromiumInstallHint(chromiumStatus));
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of input.viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.goto(input.url, { waitUntil: "networkidle", timeout: 30_000 });

      const bodyText = await page.locator("body").innerText({ timeout: 5_000 });
      const normalizedBodyText = bodyText.toLowerCase();
      for (const required of input.requiredText) {
        if (normalizedBodyText.includes(required.toLowerCase())) {
          textMatches.set(required, true);
        }
      }
      const viewportLayoutIssues = await collectLayoutIssues(page, viewport);
      layoutIssues.push(...viewportLayoutIssues);

      const screenshotPath = join(input.outDir, `${viewport.name}.png`);
      const screenshotBytes = await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push({
        viewport,
        path: screenshotPath,
        title: await page.title(),
        bodyCharacters: bodyText.length,
        analysis: analyzeScreenshotPng(screenshotBytes)
      });

      await page.close();
    }
  } finally {
    await browser.close();
  }

  const requiredText = [...textMatches.entries()].map(([text, found]) => ({ text, found }));

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    url: input.url,
    status: screenshots.every((shot) => !shot.analysis.blank) &&
      requiredText.every((check) => check.found) &&
      layoutIssues.length === 0
      ? "passed"
      : "failed",
    screenshots,
    layoutIssues,
    requiredText
  };
}

async function collectLayoutIssues(page: Page, viewport: VisualViewport): Promise<VisualLayoutIssue[]> {
  const issues = await page.evaluate(() => {
    const doc = (globalThis as any).document;
    const win = (globalThis as any).window;
    const output: Array<{ type: "horizontal-overflow" | "clipped-text" | "overlap"; selector: string; message: string; text?: string }> = [];
    const overlapCandidates: Array<{
      element: any;
      selector: string;
      rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
      text: string;
    }> = [];
    const root = doc.documentElement;

    if (root.scrollWidth > win.innerWidth + 2) {
      output.push({
        type: "horizontal-overflow",
        selector: "document",
        message: `Document scroll width ${root.scrollWidth}px exceeds viewport width ${win.innerWidth}px.`
      });
    }

    for (const element of Array.from(doc.querySelectorAll("body *")) as any[]) {
      if (output.length >= 50) {
        break;
      }

      const style = win.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visibleRect = clipRectToVisibleArea(element, rect);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        visibleRect.width < 1 ||
        visibleRect.height < 1
      ) {
        continue;
      }

      const text = elementText(element)
        .replace(/\s+/g, " ")
        .trim();

      if (!text) {
        continue;
      }

      if (isOverlapCandidate(element, visibleRect)) {
        overlapCandidates.push({
          element,
          selector: describeElement(element),
          rect: visibleRect,
          text: text.length > 80 ? `${text.slice(0, 77)}...` : text
        });
      }

      const clipsX = clipsOverflow(style.overflowX);
      const clipsY = clipsOverflow(style.overflowY);
      const overflowsX = clipsX && element.scrollWidth > element.clientWidth + 2;
      const overflowsY = clipsY && element.scrollHeight > element.clientHeight + 2;

      if (!overflowsX && !overflowsY) {
        continue;
      }

      output.push({
        type: "clipped-text",
        selector: describeElement(element),
        message: `${overflowsX ? "Horizontal" : "Vertical"} text overflow: scroll ${element.scrollWidth}x${element.scrollHeight}px, client ${element.clientWidth}x${element.clientHeight}px.`,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text
      });
    }

    for (let firstIndex = 0; firstIndex < overlapCandidates.length && output.length < 50; firstIndex += 1) {
      const first = overlapCandidates[firstIndex];

      for (let secondIndex = firstIndex + 1; secondIndex < overlapCandidates.length && output.length < 50; secondIndex += 1) {
        const second = overlapCandidates[secondIndex];

        if (first.element.contains(second.element) || second.element.contains(first.element)) {
          continue;
        }

        const overlapWidth = Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
        const overlapHeight = Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);

        if (overlapWidth <= 0 || overlapHeight <= 0) {
          continue;
        }

        const overlapArea = overlapWidth * overlapHeight;
        const firstArea = first.rect.width * first.rect.height;
        const secondArea = second.rect.width * second.rect.height;
        const smallerArea = Math.min(firstArea, secondArea);
        const overlapRatio = smallerArea > 0 ? overlapArea / smallerArea : 0;

        if (overlapArea < 48 || overlapRatio < 0.2) {
          continue;
        }

        output.push({
          type: "overlap",
          selector: `${first.selector} <-> ${second.selector}`,
          message: `Elements overlap by ${Math.round(overlapArea)}px^2 (${Math.round(overlapRatio * 100)}% of the smaller element).`,
          text: `${first.text} / ${second.text}`.slice(0, 160)
        });
      }
    }

    return output;

    function clipsOverflow(value: string): boolean {
      return value === "hidden" || value === "clip";
    }

    function isOverlapCandidate(element: any, rect: { width: number; height: number }): boolean {
      if (rect.width < 12 || rect.height < 12) {
        return false;
      }

      const tag = String(element.tagName || "").toLowerCase();
      const role = String(element.getAttribute("role") || "").toLowerCase();
      const interactive = /^(a|button|input|select|textarea)$/.test(tag) ||
        /^(button|checkbox|link|menuitem|option|radio|switch|tab)$/.test(role);
      const hasTextChild = Array.from(element.children || []).some((child: any) =>
        String(child.innerText || child.textContent || "").replace(/\s+/g, " ").trim().length > 0
      );

      return interactive || !hasTextChild;
    }

    function clipRectToVisibleArea(element: any, rect: any): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
      let left = Math.max(rect.left, 0);
      let top = Math.max(rect.top, 0);
      let right = Math.min(rect.right, win.innerWidth);
      let bottom = Math.min(rect.bottom, win.innerHeight);
      let parent = element.parentElement;

      while (parent && parent !== doc.body && parent !== doc.documentElement) {
        const parentStyle = win.getComputedStyle(parent);
        const parentRect = parent.getBoundingClientRect();

        if (clipsVisibleArea(parentStyle.overflowX)) {
          left = Math.max(left, parentRect.left);
          right = Math.min(right, parentRect.right);
        }

        if (clipsVisibleArea(parentStyle.overflowY)) {
          top = Math.max(top, parentRect.top);
          bottom = Math.min(bottom, parentRect.bottom);
        }

        parent = parent.parentElement;
      }

      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
      };
    }

    function clipsVisibleArea(value: string): boolean {
      return value === "auto" || value === "clip" || value === "hidden" || value === "scroll";
    }

    function elementText(element: any): string {
      return String(
        element.innerText ||
        element.value ||
        element.getAttribute("aria-label") ||
        element.getAttribute("alt") ||
        element.textContent ||
        ""
      );
    }

    function describeElement(element: any): string {
      const tag = String(element.tagName || "element").toLowerCase();
      const id = element.id ? `#${element.id}` : "";
      const classNames = String(element.className || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((name) => `.${name}`)
        .join("");

      return `${tag}${id}${classNames}`;
    }
  });

  return issues.map((issue) => ({ viewport, ...issue }));
}

export function analyzeScreenshotPng(bytes: Buffer): VisualScreenshotAnalysis {
  const png = PNG.sync.read(bytes);
  const totalPixels = png.width * png.height;
  const maxSamples = 1_000_000;
  const stride = Math.max(1, Math.ceil(totalPixels / maxSamples));
  let sampledPixels = 0;
  let distinctPixels = 0;
  let reference: Pixel | undefined;

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += stride) {
    const offset = pixelIndex * 4;
    const pixel: Pixel = {
      red: png.data[offset] ?? 0,
      green: png.data[offset + 1] ?? 0,
      blue: png.data[offset + 2] ?? 0,
      alpha: png.data[offset + 3] ?? 255
    };

    reference ??= pixel;
    sampledPixels += 1;

    if (pixelDistance(reference, pixel) > 24) {
      distinctPixels += 1;
    }
  }

  const distinctPixelRatio = sampledPixels > 0 ? distinctPixels / sampledPixels : 0;

  return {
    width: png.width,
    height: png.height,
    sampledPixels,
    distinctPixels,
    distinctPixelRatio: roundRatio(distinctPixelRatio),
    blank: sampledPixels === 0 || distinctPixelRatio <= 0.001
  };
}

interface Pixel {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function pixelDistance(left: Pixel, right: Pixel): number {
  return (
    Math.abs(left.red - right.red) +
    Math.abs(left.green - right.green) +
    Math.abs(left.blue - right.blue) +
    Math.abs(left.alpha - right.alpha)
  );
}

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}

export async function getChromiumRuntimeStatus(): Promise<ChromiumRuntimeStatus> {
  const executablePath = chromium.executablePath();

  try {
    await access(executablePath);

    return {
      available: true,
      executablePath,
      installCommand: chromiumInstallCommand
    };
  } catch {
    return {
      available: false,
      executablePath,
      installCommand: chromiumInstallCommand
    };
  }
}

export function formatChromiumInstallHint(status: ChromiumRuntimeStatus): string {
  if (status.available) {
    return `Playwright Chromium is available at ${status.executablePath}.`;
  }

  return [
    "Playwright Chromium is not installed.",
    `Expected executable: ${status.executablePath}`,
    `Run: ${status.installCommand}`
  ].join("\n");
}

export function parseViewportSpec(value: string | undefined): VisualViewport[] {
  if (!value) {
    return defaultViewports;
  }

  return value.split(",").map((entry) => {
    const [name, size] = entry.split(":");
    const [width, height] = (size ?? "").split("x").map((part) => Number.parseInt(part, 10));

    if (!name || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`Invalid viewport spec: ${entry}`);
    }

    return { name, width, height };
  });
}

export function parseRequiredText(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((text) => text.trim())
    .filter(Boolean);
}

function uniqueRequiredTextCandidates(candidates: string[], limit: number): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeRequiredTextCandidate(candidate);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function normalizeRequiredTextCandidate(value: string): string | undefined {
  const normalized = value
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。:：]+$/g, "");

  if (
    normalized.length < 2 ||
    normalized.length > 64 ||
    /^https?:\/\//i.test(normalized) ||
    /^[^\p{L}\p{N}]+$/u.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}
