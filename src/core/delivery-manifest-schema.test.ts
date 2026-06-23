import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const schema = JSON.parse(
  readFileSync(new URL("../../schemas/delivery-manifest.schema.json", import.meta.url), "utf8")
) as {
  required: string[];
  $defs: {
    artifact: {
      properties: {
        kind: { enum: string[] };
        status: { enum: string[] };
      };
    };
    status: {
      properties: {
        readiness: { enum: string[] };
        verification: { enum: string[] };
        visual: { enum: string[] };
        sourceChanges: { enum: string[] };
      };
    };
    counts: {
      required: string[];
    };
    evidence: {
      required: string[];
    };
    acceptanceEvidence: unknown;
    appliedChanges: unknown;
    deliveryRisk: unknown;
    verificationCommand: {
      properties: {
        outputExcerpt: { $ref: string };
      };
    };
    verificationOutputExcerpt: unknown;
    visualRequiredText: unknown;
    visualScreenshot: unknown;
  };
};

test("delivery manifest JSON schema tracks public manifest sections and status enums", () => {
  assert.deepEqual(schema.required, ["version", "generatedAt", "artifactsDir", "status", "artifacts", "counts", "evidence"]);
  assert.deepEqual(schema.$defs.artifact.properties.kind.enum, ["directory", "image", "json", "markdown"]);
  assert.deepEqual(schema.$defs.artifact.properties.status.enum, ["missing", "not-applicable", "present"]);
  assert.deepEqual(schema.$defs.status.properties.readiness.enum, ["needs attention", "ready for review"]);
  assert.deepEqual(schema.$defs.status.properties.verification.enum, ["failed", "missing", "passed", "skipped"]);
  assert.deepEqual(schema.$defs.status.properties.visual.enum, ["failed", "not-run", "passed"]);
  assert.deepEqual(schema.$defs.status.properties.sourceChanges.enum, ["applied", "not-applied", "unchanged"]);
  assert.deepEqual(schema.$defs.counts.required, [
    "acceptanceCriteria",
    "openQuestions",
    "deliveryRisks",
    "highDeliveryRisks",
    "appliedEntries",
    "appliedOperations",
    "touchedFiles",
    "verificationCommands",
    "visualScreenshots",
    "visualLayoutIssues",
    "visualRequiredText"
  ]);
  assert.deepEqual(schema.$defs.evidence.required, [
    "acceptanceCriteria",
    "verificationCommands",
    "visualScreenshots",
    "visualRequiredText",
    "appliedChanges",
    "deliveryRisks",
    "openQuestions"
  ]);
  assert.ok(schema.$defs.acceptanceEvidence);
  assert.ok(schema.$defs.appliedChanges);
  assert.ok(schema.$defs.deliveryRisk);
  assert.ok(schema.$defs.verificationCommand);
  assert.equal(schema.$defs.verificationCommand.properties.outputExcerpt.$ref, "#/$defs/verificationOutputExcerpt");
  assert.ok(schema.$defs.verificationOutputExcerpt);
  assert.ok(schema.$defs.visualRequiredText);
  assert.ok(schema.$defs.visualScreenshot);
});
