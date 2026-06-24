import assert from "node:assert/strict";
import { test } from "node:test";
import { CliError } from "./errors.js";
import { createDeliveryExecutionPlan } from "./delivery.js";

test("createDeliveryExecutionPlan keeps deliver non-destructive by default", () => {
  assert.deepEqual(createDeliveryExecutionPlan({}), {
    mode: "dry-run-only"
  });
});

test("createDeliveryExecutionPlan requires confirmation before apply", () => {
  assert.throws(
    () => createDeliveryExecutionPlan({ apply: "true", task: "T03-code-implementation" }),
    (error) =>
      error instanceof CliError &&
      error.message === "deliver --apply changes project files; pass --yes to confirm source-changing execution."
  );
});

test("createDeliveryExecutionPlan requires an apply source", () => {
  assert.throws(
    () => createDeliveryExecutionPlan({ apply: "true", yes: "true" }),
    (error) =>
      error instanceof CliError &&
      error.message === "deliver --apply requires --task <id>, --unit <id>, or --patch-set <path>."
  );
});

test("createDeliveryExecutionPlan supports AI task apply", () => {
  assert.deepEqual(createDeliveryExecutionPlan({ apply: "true", yes: "true", task: "T03-code-implementation" }), {
    mode: "apply",
    applyFlags: {
      apply: "true",
      task: "T03-code-implementation",
      unit: undefined,
      tasks: undefined,
      "patch-set": undefined,
      "save-patch-set": undefined,
      "no-source-context": undefined,
      "require-clean": undefined
    }
  });
});

test("createDeliveryExecutionPlan supports AI unit apply", () => {
  assert.deepEqual(createDeliveryExecutionPlan({ apply: "true", yes: "true", unit: "U18" }), {
    mode: "apply",
    applyFlags: {
      apply: "true",
      task: undefined,
      unit: "U18",
      tasks: undefined,
      "patch-set": undefined,
      "save-patch-set": undefined,
      "no-source-context": undefined,
      "require-clean": undefined
    }
  });
});

test("createDeliveryExecutionPlan supports reviewed patch-set apply", () => {
  assert.deepEqual(
    createDeliveryExecutionPlan({
      apply: "true",
      yes: "true",
      "patch-set": ".devflow/artifacts/patch-sets/reviewed.json"
    }),
    {
      mode: "apply",
      applyFlags: {
        apply: "true",
        task: undefined,
        unit: undefined,
        tasks: undefined,
        "patch-set": ".devflow/artifacts/patch-sets/reviewed.json",
        "save-patch-set": undefined,
        "no-source-context": undefined,
        "require-clean": undefined
      }
    }
  );
});

test("createDeliveryExecutionPlan forwards source context privacy flags", () => {
  assert.deepEqual(
    createDeliveryExecutionPlan({
      apply: "true",
      yes: "true",
      task: "T03-code-implementation",
      "no-source-context": "true"
    }),
    {
      mode: "apply",
      applyFlags: {
        apply: "true",
        task: "T03-code-implementation",
        unit: undefined,
        tasks: undefined,
        "patch-set": undefined,
        "save-patch-set": undefined,
        "no-source-context": "true",
        "require-clean": undefined
      }
    }
  );
});

test("createDeliveryExecutionPlan forwards clean worktree guardrails", () => {
  assert.deepEqual(
    createDeliveryExecutionPlan({
      apply: "true",
      yes: "true",
      task: "T03-code-implementation",
      "require-clean": "true"
    }),
    {
      mode: "apply",
      applyFlags: {
        apply: "true",
        task: "T03-code-implementation",
        unit: undefined,
        tasks: undefined,
        "patch-set": undefined,
        "save-patch-set": undefined,
        "no-source-context": undefined,
        "require-clean": "true"
      }
    }
  );
});
