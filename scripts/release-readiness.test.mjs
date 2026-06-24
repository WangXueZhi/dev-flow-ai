import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateReleaseReadiness,
  formatReleaseReadinessReport
} from "./release-readiness.mjs";

const validInput = {
  packageJson: {
    name: "dev-flow-ai",
    version: "1.2.3",
    bin: {
      "dev-flow": "./dist/cli.js"
    },
    publishConfig: {
      access: "public"
    },
    files: ["dist", "scripts/release-readiness.mjs"],
    scripts: {
      "release:readiness": "node scripts/release-readiness.mjs",
      "release:preflight": "node scripts/release-preflight.mjs"
    }
  },
  packageLock: {
    name: "dev-flow-ai",
    version: "1.2.3",
    packages: {
      "": {
        name: "dev-flow-ai",
        version: "1.2.3"
      }
    }
  },
  changelog: "# Changelog\n\n## 1.2.3\n\n- Ready.\n",
  releaseNotes: "# DevFlow v1.2.3\n\nReady.\n",
  releaseNotesPath: "/repo/docs/releases/v1.2.3.md",
  releaseWorkflow: [
    "on:",
    "  release:",
    "    types: [published]",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "  id-token: write",
    "",
    "jobs:",
    "  publish:",
    "    steps:",
    "      - name: Required live provider smoke",
    "        env:",
    "          DEVFLOW_REQUIRE_LIVE_SMOKE: \"true\"",
    "          DEVFLOW_AI_API_KEY: ${{ secrets.DEVFLOW_AI_API_KEY }}",
    "          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}",
    "        run: npm run smoke:live",
    "      - run: npm publish --provenance --access public",
    "        env:",
    "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}"
  ].join("\n"),
  releaseGuide: "Run DEVFLOW_REQUIRE_LIVE_SMOKE=true with DEVFLOW_AI_API_KEY or OPENAI_API_KEY and archive live-provider-smoke.json."
};

test("evaluateReleaseReadiness passes for complete release metadata", () => {
  const report = evaluateReleaseReadiness(validInput);
  const summary = formatReleaseReadinessReport(report);

  assert.equal(report.passed, true);
  assert.equal(report.version, "1.2.3");
  assert.equal(report.releaseTag, "v1.2.3");
  assert.match(summary, /Release readiness for dev-flow-ai@1\.2\.3/);
  assert.match(summary, /PASS Package is configured for public npm publish/);
  assert.match(summary, /Release readiness passed/);
});

test("evaluateReleaseReadiness reports incomplete release metadata", () => {
  const report = evaluateReleaseReadiness({
    ...validInput,
    packageJson: {
      ...validInput.packageJson,
      version: "1.2",
      files: ["dist"]
    },
    packageLock: {
      ...validInput.packageLock,
      version: "1.2.2",
      packages: {
        "": {
          name: "dev-flow-ai",
          version: "1.2.2"
        }
      }
    },
    changelog: "# Changelog\n",
    releaseNotes: "",
    releaseWorkflow: "permissions:\n  contents: read\n",
    releaseGuide: "Run smoke tests."
  });
  const failedIds = report.checks.filter((item) => !item.passed).map((item) => item.id);

  assert.equal(report.passed, false);
  assert.ok(failedIds.includes("package-version"));
  assert.ok(failedIds.includes("package-lock-version"));
  assert.ok(failedIds.includes("release-script-packaged"));
  assert.ok(failedIds.includes("changelog-entry"));
  assert.ok(failedIds.includes("release-notes"));
  assert.ok(failedIds.includes("release-workflow-trigger"));
  assert.ok(failedIds.includes("release-workflow-provenance"));
  assert.ok(failedIds.includes("release-workflow-live-smoke"));
  assert.ok(failedIds.includes("live-smoke-gate"));
});
