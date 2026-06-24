import assert from "node:assert/strict";
import { test } from "node:test";
import { extractChecklistItems } from "./signals.js";

test("extractChecklistItems keeps checkbox acceptance items", () => {
  assert.deepEqual(
    extractChecklistItems(
      [
        "# Requirements",
        "",
        "- [ ] Saved filters dashboard is visible.",
        "- [x] Filters persist after refresh.",
        "- Scope note that should not become acceptance.",
        "",
        "```",
        "- [ ] Ignored fenced checkbox.",
        "```"
      ].join("\n")
    ),
    [
      "Saved filters dashboard is visible.",
      "Filters persist after refresh."
    ]
  );
});

test("extractChecklistItems reads acceptance sections without checkboxes", () => {
  assert.deepEqual(
    extractChecklistItems(
      [
        "# Requirements",
        "",
        "## Scope",
        "- Build a release dashboard.",
        "",
        "## Acceptance Criteria",
        "- Release health is visible.",
        "1. Filters persist after refresh.",
        "Given a saved filter exists",
        "When the user opens the dashboard",
        "Then the filter is selected",
        "| ID | Criterion |",
        "| -- | -- |",
        "| AC-3 | Admin can export release CSV. |",
        "",
        "## Constraints",
        "- This is not an acceptance item."
      ].join("\n")
    ),
    [
      "Release health is visible.",
      "Filters persist after refresh.",
      "Given a saved filter exists",
      "When the user opens the dashboard",
      "Then the filter is selected",
      "Admin can export release CSV."
    ]
  );
});

test("extractChecklistItems reads localized acceptance headings", () => {
  assert.deepEqual(
    extractChecklistItems(
      [
        "# 需求",
        "",
        "## 验收标准",
        "- 列表页展示加载、空态和错误态。",
        "2. 详情页刷新后保留筛选条件。"
      ].join("\n")
    ),
    [
      "列表页展示加载、空态和错误态。",
      "详情页刷新后保留筛选条件。"
    ]
  );
});
