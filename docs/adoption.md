# Adoption Guide

This guide shows how to try DevFlow inside an existing frontend repository.

DevFlow is local-first. It reads your requirements, UI notes, API docs, and repository signals, then produces reviewable delivery artifacts before any source-changing step.

## 1. Install DevFlow

Until the first npm release is published, install from GitHub:

```bash
npm install --global github:WangXueZhi/dev-flow-ai
dev-flow help
```

Or run from a local clone:

```bash
git clone https://github.com/WangXueZhi/dev-flow-ai.git
cd dev-flow-ai
npm install
npm run build
node dist/cli.js help
```

Maintainers can verify the GitHub install path without touching global packages:

```bash
npm run github:smoke
```

To see the full MVP loop before trying DevFlow in your own repository:

```bash
npm run example:smoke
```

The script uses a disposable copy of `examples/react-vite-dashboard`, runs non-destructive delivery, replays the fixture-backed AI patch path, applies the patch, and verifies that delivery artifacts were generated.

## 2. Initialize Project Context

From the frontend repository you want DevFlow to inspect:

```bash
dev-flow init
```

This creates:

- `.devflow/config.json`
- `.devflow/artifacts/`
- `docs/requirements.md`
- `docs/ui.md`
- `docs/api.md`

Existing handoff documents are preserved. DevFlow creates only missing starter files and reports how many were created or already existed.

Fill those documents with the project handoff:

- Requirements: goals, users, scope, constraints, acceptance criteria, verification notes.
- UI: screens, components, states, interactions, responsive behavior, design tokens, design asset links.
- API: auth, HTTP endpoints, query/path parameters, GraphQL operations, data models, error cases, loading/cache notes, OpenAPI JSON/YAML when available.

## 3. Generate A Brief, Plan, And Tasks

```bash
dev-flow brief
dev-flow plan
dev-flow tasks
```

DevFlow writes:

- `.devflow/artifacts/project-brief.json`
- `.devflow/artifacts/implementation-plan.md`
- `.devflow/artifacts/tasks.json`
- `.devflow/artifacts/tasks.md`

These artifacts are meant for humans and AI coding agents. Review them before asking DevFlow to propose or apply source changes.

The implementation plan includes a `Frontend Delivery Blueprint` with routes/navigation, components, state/interaction, data/API integration, styling/responsive rules, test plan, and accessibility sections. Use those sections as a review checklist before source-changing execution. The generated task files also include dependency hints and type-specific review checklists on implementation units so focused `--unit` dry-runs carry their own ordering and handoff checks.

If an AI provider or fixture accidentally returns patch-set JSON during planning, DevFlow falls back to the local planner rather than writing JSON into `implementation-plan.md`. If a provider plan omits the blueprint, DevFlow appends a generated blueprint so reviewers still get the same planning checklist.

## 4. Add An AI Provider When Ready

DevFlow works without paid credentials by using deterministic fallback output. For richer planning and patch proposals, configure an OpenAI-compatible provider:

```bash
export DEVFLOW_AI_API_KEY="..."
export DEVFLOW_AI_BASE_URL="https://api.openai.com/v1"
export DEVFLOW_AI_MODEL="gpt-4.1"
```

In this repository, release maintainers can verify the provider path with:

```bash
npm run smoke:live
```

Inside a consumer project, check the local runtime and provider environment with:

```bash
dev-flow doctor
dev-flow doctor --json
```

`doctor --json` includes `promptArtifacts` and `sourceContext.enabled`, so teams can verify whether saved AI prompt artifacts exist and whether sampled repository source snippets are currently enabled for AI prompts.

It also includes `aiProvider.chatCompletionsUrl`, `aiProvider.model`, default/env source fields, and fixture override diagnostics so teams can confirm which OpenAI-compatible endpoint DevFlow would use before running a live plan, execute, or release smoke.

When using a live provider, DevFlow can omit sampled repository source snippets while still sending requirements, UI notes, API docs, project brief, task plan, and target profile context:

```bash
DEVFLOW_SOURCE_CONTEXT=none dev-flow execute --dry-run
dev-flow deliver --no-source-context
```

For teams that want to inspect AI context before use, save prompt artifacts locally:

```bash
dev-flow plan --save-prompt .devflow/artifacts/prompts/plan.prompt.md
dev-flow execute --dry-run --save-prompt .devflow/artifacts/prompts/dry-run
dev-flow deliver --save-prompts .devflow/artifacts/prompts
```

Saved prompts may include requirements, UI notes, API docs, project brief data, target profiles, and sampled source snippets when source context is enabled. Treat them as local review artifacts unless your team explicitly approves sharing that context. Delivery reports and manifests index the prompt artifact directory and file count without duplicating prompt contents.

## 5. Propose Changes Before Applying Them

Start with a non-destructive dry run:

```bash
dev-flow execute --dry-run
dev-flow execute --dry-run --unit U18
```

Dry-run proposals are written to `.devflow/artifacts/patch-proposals/` and do not modify source files.

## 6. Apply Reviewed Patch Sets

Source-changing delivery is opt-in.

Use a reviewed patch set:

```bash
dev-flow execute --validate --patch-set path/to/patch-set.json
dev-flow execute --apply --patch-set path/to/patch-set.json
```

Or, with an AI provider configured, ask DevFlow for a task-scoped patch set:

```bash
dev-flow execute --apply --task T03-code-implementation
dev-flow execute --apply --unit U18
dev-flow execute --apply --task T03-code-implementation --save-prompt .devflow/artifacts/prompts/apply.prompt.md
dev-flow execute --apply --task T03-code-implementation --review-note "Reviewer should check generated copy before merge."
dev-flow execute --apply --task T03-code-implementation --require-clean
```

Every apply creates a backup under `.devflow/artifacts/backups/`, records structured execution history in `.devflow/artifacts/execution-log.json`, and writes a reviewer-friendly `.devflow/artifacts/task-changelog.md`. The changelog includes default and reviewer-authored notes plus links to the execution log, verification report, and delivery report so review can continue after verification runs. Later `dev-flow verify` runs refresh the existing changelog with a Verification Summary block. If an apply fails after partial writes, DevFlow restores the backup automatically.

Use `--require-clean` for team or CI workflows that should stop source-changing apply when `git status --porcelain` reports local changes outside `.devflow/artifacts`.

Manual rollback is also available:

```bash
dev-flow execute --rollback --backup .devflow/artifacts/backups/<id>/manifest.json
```

## 7. Verify And Capture Visual Evidence

Run project verification:

```bash
dev-flow verify
```

When a task changelog exists, verification updates it with status, report path, and command exit codes.

With a preview server running, capture visual checks:

```bash
dev-flow visual --url http://127.0.0.1:5173 --text Home,Checkout
```

Visual checks capture desktop, tablet, and mobile screenshots, blank-screen analysis, basic layout issue checks for overflow, clipped text, and overlapping visible elements, plus required text checks. `dev-flow deliver --preview-url <url>` infers default text checks from design asset text snippets and UI state labels when `--visual-text` is omitted; `dev-flow visual` uses only explicit `--text` values.

## 8. Run The Full Delivery Flow

For a non-destructive delivery pass:

```bash
dev-flow deliver \
  --requirements docs/requirements.md \
  --ui docs/ui.md \
  --api docs/api.md \
  --save-prompts .devflow/artifacts/prompts
```

With visual evidence:

```bash
dev-flow deliver \
  --requirements docs/requirements.md \
  --ui docs/ui.md \
  --api docs/api.md \
  --preview-url http://127.0.0.1:5173 \
  --visual-text Home,Checkout
```

For source-changing delivery, keep confirmation explicit:

```bash
dev-flow deliver --apply --yes --patch-set path/to/reviewed-patch-set.json
```

The final report is written to `.devflow/artifacts/delivery-report.md`. It includes source documents, acceptance criteria, per-criterion delivery evidence, verification status, optional visual checks with embedded screenshots when available, applied changes, task changelog review handoff notes, the latest changelog Verification Summary when available, design tokens, risk assessment, open questions, and delivery readiness.

DevFlow also writes `.devflow/artifacts/delivery-manifest.json`. Use this JSON artifact when CI, an editor extension, or a downstream agent needs artifact paths, prompt artifact status, readiness, verification status, source-change status, source-context sampling evidence, design tokens, screenshot paths, touched files, task changelog reviewer notes and verification summaries, backups, open questions, and delivery risks without parsing Markdown.

Validate the manifest with `schemas/delivery-manifest.schema.json` when building stricter CI or editor integrations.

For a quick local summary, run:

```bash
dev-flow status
dev-flow status --json
dev-flow status --fail-on-attention
dev-flow status --fail-on-failed-verification
```

The status output includes reviewer notes, verification remediation hints, structured next actions, and source-context sampling evidence from the delivery manifest when available, using only path-level metadata so CI logs do not expose sampled source snippets.

Use `--fail-on-attention` as a CI gate when delivery readiness must be `ready for review`. Use `--fail-on-failed-verification` when the job should fail only if the manifest records failed verification.

## 9. Add DevFlow To CI

Use the composite GitHub Action:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    requirements: docs/requirements.md
    ui: docs/ui.md
    api: docs/api.md
```

Set `fail-on-attention: "true"` or `fail-on-failed-verification: "true"` in the action inputs when the workflow should fail from manifest-backed delivery status gates.

Use `WangXueZhi/dev-flow-ai@v0.1.0` after the first release tag is published.

The action defaults to non-destructive delivery. Source-changing CI delivery requires both `apply: "true"` and `confirm-apply: "true"`.

## Suggested First Trial

Pick a small frontend change with:

- One user story.
- One or two screens.
- One API endpoint or mock response.
- A reliable build command.
- A local preview URL.

Run `dev-flow deliver` first without `--apply`, inspect the artifacts, then decide whether to use a reviewed patch set or an AI-generated patch set.
