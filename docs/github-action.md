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

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: devflow-artifacts
          path: .devflow/artifacts
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
