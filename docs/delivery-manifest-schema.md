# Delivery Manifest Schema

`dev-flow report` writes a human-readable delivery report and a machine-readable delivery manifest.

The manifest is written to:

```text
.devflow/artifacts/delivery-manifest.json
```

The machine-readable schema is available at:

```text
schemas/delivery-manifest.schema.json
```

Use it when configuring CI artifact checks, editor integrations, dashboards, or downstream AI agents that need to inspect delivery readiness without parsing Markdown.

## What It Covers

The manifest schema describes:

- Overall delivery status: readiness, verification, visual verification, and source-change state.
- Source document paths when a project brief is available.
- Artifact entries with path, kind, required flag, status, role, and optional count.
- Delivery counts for acceptance criteria, open questions, delivery risks, design tokens, changed files, verification commands, visual evidence, and applied operations.
- Acceptance evidence with status, evidence, known gaps, assumptions, and manual QA prompts.
- Design token evidence extracted from UI notes for color, typography, spacing, radius, shadows, motion, and iconography.
- Verification command summaries with optional bounded stdout/stderr excerpts for failed commands.
- Visual screenshots and required text checks.
- Applied-change summaries with touched files, operation counts, line delta, task changelog artifact, and backup manifests.
- Source-context sampling summaries with task id, mode, selected unit metadata, sampled path entries, omitted candidates, and sampling limits.
- Delivery risks and open questions.

## Artifact Status

Artifact entries use these statuses:

- `present`: the artifact exists for this delivery.
- `missing`: the artifact is expected for this delivery but was not found.
- `not-applicable`: the artifact is optional or intentionally suppressed for this delivery.

For example, `dev-flow report --visual-report none` marks the visual report artifact as `not-applicable` even if an older visual report exists on disk.

## Status Fields

Top-level delivery status fields use stable enums:

- `readiness`: `ready for review` or `needs attention`.
- `verification`: `passed`, `failed`, `skipped`, or `missing`.
- `visual`: `passed`, `failed`, or `not-run`.
- `sourceChanges`: `applied`, `unchanged`, or `not-applied`.

## Relationship To Markdown Reports

The Markdown delivery report is optimized for reviewers.

The JSON manifest is optimized for tools. Prefer the manifest when automation needs to locate artifacts, gate delivery readiness, summarize evidence, or route follow-up work to another agent.

Verification command entries may include `outputExcerpt` when a command fails. Excerpts are bounded summaries intended for CI logs, dashboards, and follow-up agents; use the full verification report when complete command output is required.
