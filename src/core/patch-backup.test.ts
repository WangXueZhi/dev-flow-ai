import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createPatchBackup, restorePatchBackup } from "./patch-backup.js";
import { applyPatchSet, type PatchSet } from "./patch-set.js";

test("createPatchBackup and restorePatchBackup restore changed files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-rollback-"));
  await writeFile(join(root, "app.txt"), "before\n", "utf8");
  const patchSet: PatchSet = {
    version: 1,
    taskId: "T03-code-implementation",
    summary: "Change app text.",
    operations: [{ type: "replace", path: "app.txt", search: "before", replace: "after" }]
  };
  const backup = await createPatchBackup(patchSet, join(root, ".devflow/backups/one"), root);

  await applyPatchSet(patchSet, root);
  assert.equal(await readFile(join(root, "app.txt"), "utf8"), "after\n");

  const rollback = await restorePatchBackup(backup.manifestPath, root);
  assert.equal(await readFile(join(root, "app.txt"), "utf8"), "before\n");
  assert.deepEqual(rollback.files, [{ path: "app.txt", action: "restored" }]);
});

test("restorePatchBackup removes files that did not exist before apply", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-rollback-new-"));
  const patchSet: PatchSet = {
    version: 1,
    taskId: "T03-code-implementation",
    summary: "Create file.",
    operations: [{ type: "write", path: "created.txt", content: "created\n" }]
  };
  const backup = await createPatchBackup(patchSet, join(root, ".devflow/backups/one"), root);

  await applyPatchSet(patchSet, root);
  assert.equal(await readFile(join(root, "created.txt"), "utf8"), "created\n");

  const rollback = await restorePatchBackup(backup.manifestPath, root);
  await assert.rejects(() => readFile(join(root, "created.txt"), "utf8"));
  assert.deepEqual(rollback.files, [{ path: "created.txt", action: "removed" }]);
});
