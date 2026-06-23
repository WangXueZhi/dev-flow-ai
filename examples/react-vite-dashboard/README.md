# React Vite Dashboard Example

This example is a small frontend target for DevFlow. It contains product documents plus a working React/Vite dashboard that can be planned, tasked, verified, and reported through the DevFlow CLI.

From the repository root, run `npm run example:smoke` to exercise this example in a disposable copy under `.devflow/example-smoke/`.

## Source Documents

- `docs/requirements.md`
- `docs/ui.md`
- `docs/api.md`

## Run

```bash
npm install
npm run build
npm run dev
```

## DevFlow Flow

From this directory, a developer can run:

```bash
../../dist/cli.js init
../../dist/cli.js plan --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
../../dist/cli.js tasks
../../dist/cli.js execute --dry-run --task T03-code-implementation
../../dist/cli.js execute --dry-run --unit U18
../../dist/cli.js verify
../../dist/cli.js report
```

Or run the safe delivery orchestrator:

```bash
node ../../dist/cli.js deliver --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
node ../../dist/cli.js deliver --unit U18 --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
```

For visual verification, run the preview in one terminal:

```bash
npx playwright install chromium
npm run dev -- --host 127.0.0.1
```

Then run:

```bash
node ../../dist/cli.js visual --url http://127.0.0.1:5173 --text OpsBoard,Checkout
node ../../dist/cli.js report
```

Or:

```bash
node ../../dist/cli.js deliver --preview-url http://127.0.0.1:5173 --visual-text OpsBoard,Checkout
```

To apply a reviewed patch set during delivery, keep the confirmation explicit:

```bash
node ../../dist/cli.js deliver \
  --apply \
  --yes \
  --patch-set fixtures/patch-set-ai-applied.json \
  --preview-url http://127.0.0.1:5173 \
  --visual-text OpsBoard,Checkout,"AI applied"
```

To replay the AI patch-set path without a live model:

```bash
DEVFLOW_AI_FIXTURE_PATH=fixtures/patch-set-ai-applied.json \
  node ../../dist/cli.js execute --apply --task T03-code-implementation \
  --save-patch-set .devflow/artifacts/patch-sets/ai-applied.json
```

For unit-scoped delivery with the same fixture:

```bash
DEVFLOW_AI_FIXTURE_PATH=fixtures/patch-set-ai-applied.json \
  node ../../dist/cli.js deliver --apply --yes --unit U18
```
