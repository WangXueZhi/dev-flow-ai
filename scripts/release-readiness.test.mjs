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
    files: ["dist", "scripts/release-readiness.mjs", "scripts/verify-live-smoke-report.mjs"],
    scripts: {
      "release:readiness": "node scripts/release-readiness.mjs",
      "release:preflight": "node scripts/release-preflight.mjs",
      "smoke:live:report": "node scripts/verify-live-smoke-report.mjs"
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
    "    env:",
    "      DEVFLOW_LIVE_SMOKE_REPORT: .devflow/artifacts/live-provider-smoke.json",
    "    steps:",
    "      - name: Check release readiness",
    "        run: npm run release:readiness",
    "      - name: Required live provider smoke",
    "        env:",
    "          DEVFLOW_REQUIRE_LIVE_SMOKE: \"true\"",
    "          DEVFLOW_AI_API_KEY: ${{ secrets.DEVFLOW_AI_API_KEY }}",
    "          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}",
    "        run: npm run smoke:live",
    "      - name: Verify optional live provider smoke report",
    "        run: npm run smoke:live:report",
    "      - name: Verify required live provider smoke report",
    "        run: npm run smoke:live:report -- --require-passed",
    "      - name: Upload live provider smoke report",
    "        uses: actions/upload-artifact@v7",
    "        if: ${{ always() }}",
    "        with:",
    "          name: live-provider-smoke-report",
    "          path: .devflow/artifacts/live-provider-smoke.json",
    "          if-no-files-found: warn",
    "      - run: npm publish --provenance --access public",
    "        env:",
    "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}"
  ].join("\n"),
  releaseGuide:
    "Run DEVFLOW_REQUIRE_LIVE_SMOKE=true with DEVFLOW_AI_API_KEY or OPENAI_API_KEY, validate it with npm run smoke:live:report -- --require-passed, and archive live-provider-smoke.json. The live-provider-smoke-report workflow artifact stores the JSON evidence."
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
      files: ["dist"],
      scripts: {
        "release:readiness": "node scripts/release-readiness.mjs"
      }
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
  assert.ok(failedIds.includes("release-script"));
  assert.ok(failedIds.includes("release-script-packaged"));
  assert.ok(failedIds.includes("changelog-entry"));
  assert.ok(failedIds.includes("release-notes"));
  assert.ok(failedIds.includes("release-workflow-trigger"));
  assert.ok(failedIds.includes("release-workflow-provenance"));
  assert.ok(failedIds.includes("release-workflow-readiness"));
  assert.ok(failedIds.includes("release-workflow-live-smoke"));
  assert.ok(failedIds.includes("release-workflow-live-smoke-artifact"));
  assert.ok(failedIds.includes("release-workflow-live-smoke-report-gate"));
  assert.ok(failedIds.includes("live-smoke-gate"));
});
