import assert from "node:assert/strict";
import { test } from "node:test";
import { getSourceContextPolicy, shouldIncludeSourceContext } from "./source-context-policy.js";

test("source context policy defaults to enabled", () => {
  const policy = getSourceContextPolicy({}, {});

  assert.equal(policy.enabled, true);
  assert.equal(policy.source, "default");
  assert.equal(shouldIncludeSourceContext({}, {}), true);
});

test("source context policy can be disabled by flag", () => {
  const policy = getSourceContextPolicy({ "no-source-context": "true" }, {});

  assert.equal(policy.enabled, false);
  assert.equal(policy.source, "flag");
  assert.equal(policy.value, "--no-source-context");
});

test("source context policy can be disabled by environment", () => {
  for (const value of ["0", "false", "none", "off", "disabled"]) {
    const policy = getSourceContextPolicy({}, { DEVFLOW_SOURCE_CONTEXT: value });

    assert.equal(policy.enabled, false);
    assert.equal(policy.source, "env");
    assert.equal(policy.value, value);
  }
});
