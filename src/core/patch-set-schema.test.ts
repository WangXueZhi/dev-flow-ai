import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { patchSetLimits } from "./patch-set.js";

const schema = JSON.parse(
  readFileSync(new URL("../../schemas/patch-set.schema.json", import.meta.url), "utf8")
) as {
  properties: {
    operations: {
      maxItems: number;
    };
  };
  $defs: Record<string, unknown>;
};

test("patch set JSON schema tracks runtime operation limits and operation kinds", () => {
  assert.equal(schema.properties.operations.maxItems, patchSetLimits.maxOperations);
  assert.ok(schema.$defs.writeOperation);
  assert.ok(schema.$defs.replaceOperation);
  assert.ok(schema.$defs.deleteOperation);
  assert.ok(schema.$defs.safeRelativePath);
});
