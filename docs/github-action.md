# GitHub Action

DevFlow includes a composite GitHub Action for running the safe delivery workflow in frontend repositories.

The action defaults to non-destructive delivery. It runs `dev-flow deliver`, writes DevFlow artifacts, and only performs source-changing execution when both `apply: "true"` and `confirm-apply: "true"` are provided.

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

      - uses: WangXueZhi/dev-flow-ai@v0.1.0
        with:
          requirements: docs/requirements.md
          ui: docs/ui.md
          api: docs/api.md
          upload-artifacts: "true"
```

## Visual Checks

Start the app preview before invoking DevFlow, then pass the preview URL and text checks:

```yaml
- run: npm ci
- run: npm run build
- run: |
    npm run dev -- --host 127.0.0.1 > /tmp/devflow-preview.log 2>&1 &
    echo $! > /tmp/devflow-preview.pid

- uses: WangXueZhi/dev-flow-ai@v0.1.0
  with:
    install-chromium: "true"
    preview-url: http://127.0.0.1:5173
    visual-text: OpsBoard,Checkout
```

## Artifact Uploads

Set `upload-artifacts: "true"` to upload `.devflow/artifacts` from the selected working directory after delivery:

```yaml
- uses: WangXueZhi/dev-flow-ai@v0.1.0
  with:
    upload-artifacts: "true"
    artifact-name: devflow-artifacts
```

Use `artifacts-path` when your project writes artifacts somewhere other than `.devflow/artifacts`.

## AI Provider

Pass provider configuration through environment variables or GitHub secrets. The action does not require secrets for fallback planning and dry-run proposals.

```yaml
- uses: WangXueZhi/dev-flow-ai@v0.1.0
  env:
    DEVFLOW_AI_API_KEY: ${{ secrets.DEVFLOW_AI_API_KEY }}
    DEVFLOW_AI_BASE_URL: https://api.openai.com/v1
    DEVFLOW_AI_MODEL: gpt-4.1
```

For deterministic CI, use a fixture:

```yaml
- uses: WangXueZhi/dev-flow-ai@v0.1.0
  env:
    DEVFLOW_AI_FIXTURE_PATH: fixtures/patch-set.json
```

## Source-Changing Delivery

Source-changing delivery must be explicit:

```yaml
- uses: WangXueZhi/dev-flow-ai@v0.1.0
  with:
    apply: "true"
    confirm-apply: "true"
    patch-set: .devflow/artifacts/patch-sets/reviewed.json
```

Without `confirm-apply: "true"`, the action exits before running `dev-flow deliver --apply`.

## Inputs

- `version`: npm version or dist-tag of `dev-flow-ai` to run. Default: `latest`.
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
- `upload-artifacts`: upload DevFlow artifacts after delivery. Default: `"false"`.
- `artifact-name`: artifact name when `upload-artifacts` is enabled. Default: `devflow-artifacts`.
- `artifacts-path`: artifact path relative to `working-directory`. Default: `.devflow/artifacts`.
