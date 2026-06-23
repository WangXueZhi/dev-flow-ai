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
  type: "horizontal-overflow" | "clipped-text";
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
  { name: "tablet", width: 900, height: 1100 }
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
    const output: Array<{ type: "horizontal-overflow" | "clipped-text"; selector: string; message: string; text?: string }> = [];
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

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width < 1 ||
        rect.height < 1
      ) {
        continue;
      }

      const text = String(element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) {
        continue;
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

    return output;

    function clipsOverflow(value: string): boolean {
      return value === "hidden" || value === "clip";
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
    /^[\W_]+$/.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}
