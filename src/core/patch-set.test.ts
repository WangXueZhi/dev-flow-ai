import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyPatchSet, parsePatchSet, patchSetLimits, validatePatchPath, validatePatchSet, type PatchSet } from "./patch-set.js";

const patchSet: PatchSet = {
  version: 1,
  taskId: "T03-code-implementation",
  summary: "Add generated source file.",
  operations: [
    {
      type: "write",
      path: "src/generated.ts",
      content: "export const generated = true;\n"
    }
  ]
};

test("applyPatchSet writes files and reports unchanged on repeat", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-patch-"));
  const first = await applyPatchSet(patchSet, root);
  const content = await readFile(join(root, "src/generated.ts"), "utf8");
  const second = await applyPatchSet(patchSet, root);

  assert.equal(content, "export const generated = true;\n");
  assert.equal(first.status, "applied");
  assert.equal(first.operations[0]?.status, "written");
  assert.equal(first.operations[0]?.linesBefore, 0);
  assert.equal(first.operations[0]?.linesAfter, 1);
  assert.equal(first.operations[0]?.lineDelta, 1);
  assert.equal(second.status, "unchanged");
  assert.equal(second.operations[0]?.linesBefore, 1);
  assert.equal(second.operations[0]?.linesAfter, 1);
  assert.equal(second.operations[0]?.lineDelta, 0);
});

test("applyPatchSet replaces text in existing files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-replace-"));
  await applyPatchSet(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Create file before replace.",
      operations: [{ type: "write", path: "src/App.jsx", content: "Hello old world\n" }]
    },
    root
  );
  const report = await applyPatchSet(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Replace text.",
      operations: [
        {
          type: "replace",
          path: "src/App.jsx",
          search: "old",
          replace: "new",
          expectedReplacements: 1
        }
      ]
    },
    root
  );
  const content = await readFile(join(root, "src/App.jsx"), "utf8");

  assert.equal(content, "Hello new world\n");
  assert.equal(report.operations[0]?.type, "replace");
  assert.equal(report.operations[0]?.replacements, 1);
  assert.equal(report.operations[0]?.linesBefore, 1);
  assert.equal(report.operations[0]?.linesAfter, 1);
  assert.equal(report.operations[0]?.lineDelta, 0);
});

test("applyPatchSet deletes files and reports unchanged on repeat", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-delete-"));
  await applyPatchSet(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Create file before delete.",
      operations: [{ type: "write", path: "src/obsolete.ts", content: "one\ntwo\n" }]
    },
    root
  );
  const first = await applyPatchSet(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Delete obsolete source file.",
      operations: [{ type: "delete", path: "src/obsolete.ts" }]
    },
    root
  );
  const second = await applyPatchSet(
    {
      version: 1,
      taskId: "T03-code-implementation",
      summary: "Delete obsolete source file again.",
      operations: [{ type: "delete", path: "src/obsolete.ts" }]
    },
    root
  );

  assert.equal(existsSync(join(root, "src/obsolete.ts")), false);
  assert.equal(first.status, "applied");
  assert.equal(first.operations[0]?.type, "delete");
  assert.equal(first.operations[0]?.status, "deleted");
  assert.equal(first.operations[0]?.linesBefore, 2);
  assert.equal(first.operations[0]?.linesAfter, 0);
  assert.equal(first.operations[0]?.lineDelta, -2);
  assert.equal(second.status, "unchanged");
  assert.equal(second.operations[0]?.status, "unchanged");
});

test("applyPatchSet can require delete targets to exist", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-delete-missing-"));

  await assert.rejects(
    () =>
      applyPatchSet(
        {
          version: 1,
          taskId: "T03-code-implementation",
          summary: "Delete required source file.",
          operations: [{ type: "delete", path: "src/missing.ts", missingOk: false }]
        },
        root
      ),
    /Cannot delete missing file/
  );
});

test("validatePatchPath rejects unsafe paths", () => {
  assert.throws(() => validatePatchPath("../outside.ts"), /inside the project/);
  assert.throws(() => validatePatchPath("/tmp/outside.ts"), /relative/);
  assert.throws(() => validatePatchPath(".git/config"), /cannot target .git/);
  assert.throws(() => validatePatchPath("node_modules/pkg/index.js"), /cannot target node_modules/);
});

test("validatePatchSet rejects oversized patch sets", () => {
  assert.throws(
    () =>
      validatePatchSet({
        version: 1,
        taskId: "T03-code-implementation",
        summary: "Too many operations.",
        operations: Array.from({ length: patchSetLimits.maxOperations + 1 }, (_, index) => ({
          type: "write",
          path: `src/generated-${index}.ts`,
          content: "ok\n"
        }))
      }),
    /too many operations/
  );

  assert.throws(
    () =>
      validatePatchSet({
        version: 1,
        taskId: "T03-code-implementation",
        summary: "Too large.",
        operations: [
          {
            type: "write",
            path: "src/huge.ts",
            content: "x".repeat(patchSetLimits.maxWriteBytes + 1)
          }
        ]
      }),
    /exceeds/
  );

  assert.throws(
    () =>
      validatePatchSet({
        version: 1,
        taskId: "T03-code-implementation",
        summary: "Replacement too large.",
        operations: [
          {
            type: "replace",
            path: "src/App.tsx",
            search: "old",
            replace: "x".repeat(patchSetLimits.maxReplaceBytes + 1)
          }
        ]
      }),
    /replacement.*exceeds/
  );
});

test("parsePatchSet extracts JSON from fenced AI responses", () => {
  const parsed = parsePatchSet(`Here is the patch:\n\n\`\`\`json\n${JSON.stringify(patchSet)}\n\`\`\``);

  assert.equal(parsed.taskId, "T03-code-implementation");
  assert.equal(parsed.operations[0]?.path, "src/generated.ts");
});
