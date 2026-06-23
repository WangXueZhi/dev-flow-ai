# GitHub Action

DevFlow includes a composite GitHub Action for running the safe delivery workflow in frontend repositories.

The action defaults to non-destructive delivery. It runs `dev-flow deliver`, writes DevFlow artifacts, and only performs source-changing execution when both `apply: "true"` and `confirm-apply: "true"` are provided.

By default, the action also writes a DevFlow section to the GitHub Actions job summary using `.devflow/artifacts/delivery-manifest.json`. The summary includes readiness, verification, visual status, source-change status, counts, key artifact paths, source-context sampling evidence, bounded verification failure excerpts, top risks, and open questions.

## Basic Workflow

```yaml
name: DevFlow

on:
  pull_request:

jobs:
  devflow:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - uses: WangXueZhi/dev-flow-ai@main
        with:
          requirements: docs/requirements.md
          ui: docs/ui.md
          api: docs/api.md
          upload-artifacts: "true"
```

Use `WangXueZhi/dev-flow-ai@v0.1.0` after the first release tag is published.

## Visual Checks

Start the app preview before invoking DevFlow, then pass the preview URL and text checks:

```yaml
- run: npm ci
- run: npm run build
- run: |
    npm run dev -- --host 127.0.0.1 > /tmp/devflow-preview.log 2>&1 &
    echo $! > /tmp/devflow-preview.pid

- uses: WangXueZhi/dev-flow-ai@main
  with:
    install-chromium: "true"
    preview-url: http://127.0.0.1:5173
    visual-text: OpsBoard,Checkout
```

## Artifact Uploads

Set `upload-artifacts: "true"` to upload `.devflow/artifacts` from the selected working directory after delivery:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    upload-artifacts: "true"
    artifact-name: devflow-artifacts
```

Use `artifacts-path` when your project writes artifacts somewhere other than `.devflow/artifacts`.

Uploaded artifacts include `.devflow/artifacts/delivery-manifest.json`, a machine-readable index of artifact paths, delivery readiness, verification and visual status, source-change status, source-context sampling evidence, screenshots, touched files, backups, open questions, and delivery risks.

Tools that inspect the uploaded manifest can validate it with `schemas/delivery-manifest.schema.json`.

## Job Summary

The action writes a compact delivery summary to `$GITHUB_STEP_SUMMARY` by default. When source-context sampling ran, the summary includes only path-level evidence such as run count, latest task or unit, sampled paths, and omitted candidate count:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    upload-artifacts: "true"
```

Disable it when a workflow needs artifacts only:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    job-summary: "false"
```

## Delivery Gates

Use manifest-backed status gates when CI should fail on delivery readiness or verification state:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    fail-on-attention: "true"
    fail-on-failed-verification: "true"
```

`fail-on-attention` runs `dev-flow status --fail-on-attention` after delivery and fails when readiness is not `ready for review`. `fail-on-failed-verification` runs `dev-flow status --fail-on-failed-verification` and fails when manifest verification status is `failed`.

Job summaries and artifact uploads run with `always()` so failed deliveries and failed gates can still leave reviewable evidence when their inputs are enabled.

## AI Provider

Pass provider configuration through environment variables or GitHub secrets. The action does not require secrets for fallback planning and dry-run proposals.

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  env:
    DEVFLOW_AI_API_KEY: ${{ secrets.DEVFLOW_AI_API_KEY }}
    DEVFLOW_AI_BASE_URL: https://api.openai.com/v1
    DEVFLOW_AI_MODEL: gpt-4.1
```

Set `source-context: "false"` to omit sampled repository source snippets from AI prompts while still sending requirements, UI notes, API docs, project brief, task plan, and target profile context:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    source-context: "false"
```

For deterministic CI, use a fixture:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  env:
    DEVFLOW_AI_FIXTURE_PATH: fixtures/patch-set.json
```

## Source-Changing Delivery

Source-changing delivery must be explicit:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    apply: "true"
    confirm-apply: "true"
    patch-set: .devflow/artifacts/patch-sets/reviewed.json
```

Without `confirm-apply: "true"`, the action exits before running `dev-flow deliver --apply`.

When `patch-set` is provided, the action runs `dev-flow execute --validate --patch-set <path>` before delivery so reviewed patch sets are checked before any source-changing apply.

## Inputs

- `version`: npm version, dist-tag, or package spec of `dev-flow-ai` to run. Default: `github:WangXueZhi/dev-flow-ai#main` until the first npm release is published.
- `working-directory`: repository subdirectory where DevFlow should run. Default: `.`.
- `requirements`: requirements document path. Default: `docs/requirements.md`.
- `ui`: UI notes path. Default: `docs/ui.md`.
- `api`: API documentation path. Default: `docs/api.md`.
- `task`: optional task id.
- `unit`: optional implementation unit id.
- `preview-url`: optional preview URL for visual checks.
- `visual-text`: optional comma-separated text checks.
- `viewport`: optional viewport specs.
- `verify-command`: optional verification command override.
- `install-chromium`: install Playwright Chromium before visual checks. Default: `"false"`.
- `apply`: run source-changing delivery. Default: `"false"`.
- `confirm-apply`: required confirmation for source-changing delivery. Default: `"false"`.
- `patch-set`: optional reviewed patch-set JSON path.
- `save-patch-set`: optional path for saving AI-generated patch sets.
- `source-context`: include bounded repository source snippets in AI prompts. Set to `"false"` to omit sampled source snippets. Default: `"true"`.
- `upload-artifacts`: upload DevFlow artifacts after delivery. Default: `"false"`.
- `artifact-name`: artifact name when `upload-artifacts` is enabled. Default: `devflow-artifacts`.
- `artifacts-path`: artifact path relative to `working-directory`. Default: `.devflow/artifacts`.
- `job-summary`: write delivery readiness, evidence counts, artifact paths, top risks, and open questions to the GitHub job summary. Default: `"true"`.
- `fail-on-attention`: fail when delivery readiness is not `ready for review`. Default: `"false"`.
- `fail-on-failed-verification`: fail when manifest verification status is `failed`. Default: `"false"`.
