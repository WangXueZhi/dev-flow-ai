import assert from "node:assert/strict";
import { test } from "node:test";
import { PNG } from "pngjs";
import {
  analyzeScreenshotPng,
  chromiumInstallCommand,
  defaultViewports,
  formatChromiumInstallHint,
  inferRequiredTextFromBrief,
  parseRequiredText,
  parseViewportSpec
} from "./visual.js";
import type { ProjectBrief } from "./brief.js";

test("parseViewportSpec returns defaults when absent", () => {
  assert.deepEqual(parseViewportSpec(undefined), defaultViewports);
});

test("parseViewportSpec parses named dimensions", () => {
  assert.deepEqual(parseViewportSpec("desktop:1440x1000,tablet:900x1100"), [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "tablet", width: 900, height: 1100 }
  ]);
});

test("parseRequiredText trims comma-separated checks", () => {
  assert.deepEqual(parseRequiredText("OpsBoard, Checkout ,"), ["OpsBoard", "Checkout"]);
});

test("inferRequiredTextFromBrief derives visual text from design snippets and UI states", () => {
  const brief: ProjectBrief = {
    version: 1,
    sourceDocuments: {
      requirementsPath: "docs/requirements.md",
      uiPath: "docs/ui.md",
      apiPath: "docs/api.md"
    },
    stack: {
      packageManager: "npm",
      runtimes: ["Node.js"],
      frameworks: ["React"],
      buildTools: ["Vite"],
      styling: [],
      testing: [],
      scripts: {},
      sourceDirectories: ["src"],
      configFiles: [],
      notes: []
    },
    signals: {
      requirements: [],
      ui: [],
      api: []
    },
    designAssets: [
      {
        source: "ui-markdown-image",
        kind: "local",
        altText: "Dashboard wireframe",
        reference: "assets/dashboard.svg",
        resolvedPath: "docs/assets/dashboard.svg",
        exists: true,
        metadata: {
          textSnippets: ["Release health", "Deploy confidence", "Release health", "https://example.com"]
        }
      }
    ],
    uiStateChecklist: [
      {
        kind: "state",
        sourceLine: 12,
        summary: "Blocked: action required label."
      },
      {
        kind: "responsive",
        sourceLine: 16,
        summary: "Desktop: two-column work surface."
      },
      {
        kind: "component",
        sourceLine: 20,
        summary: "Incident queue: severity and owner list."
      }
    ],
    apiContracts: [],
    apiDataModels: [],
    apiErrorCases: [],
    apiAuthRequirements: [],
    invalidApiDataModels: [],
    userStories: [],
    constraints: [],
    acceptanceCriteria: ["Release health and deploy confidence are visible in the first viewport."],
    deliveryRisks: [],
    openQuestions: [],
    recommendedVerification: []
  };

  assert.deepEqual(inferRequiredTextFromBrief(brief), [
    "Release health",
    "Deploy confidence",
    "Blocked"
  ]);
});

test("analyzeScreenshotPng marks uniform screenshots as blank", () => {
  const analysis = analyzeScreenshotPng(createPng(10, 10, () => [255, 255, 255, 255]));

  assert.equal(analysis.width, 10);
  assert.equal(analysis.height, 10);
  assert.equal(analysis.blank, true);
  assert.equal(analysis.distinctPixelRatio, 0);
});

test("analyzeScreenshotPng marks varied screenshots as non-blank", () => {
  const analysis = analyzeScreenshotPng(
    createPng(10, 10, (x) => (x < 5 ? [255, 255, 255, 255] : [20, 80, 160, 255]))
  );

  assert.equal(analysis.blank, false);
  assert.equal(analysis.distinctPixels, 50);
  assert.equal(analysis.distinctPixelRatio, 0.5);
});

test("formatChromiumInstallHint gives an actionable install command", () => {
  assert.equal(
    formatChromiumInstallHint({
      available: false,
      executablePath: "/tmp/missing/chromium",
      installCommand: chromiumInstallCommand
    }),
    [
      "Playwright Chromium is not installed.",
      "Expected executable: /tmp/missing/chromium",
      "Run: npx playwright install chromium"
    ].join("\n")
  );
});

function createPng(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (width * y + x) * 4;
      const [red, green, blue, alpha] = colorAt(x, y);
      png.data[offset] = red;
      png.data[offset + 1] = green;
      png.data[offset + 2] = blue;
      png.data[offset + 3] = alpha;
    }
  }

  return PNG.sync.write(png);
}
