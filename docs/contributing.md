# Contributing

DevFlow is early, so high-signal contributions matter more than broad surface area.

## Good First Contributions

- Improve generated plan structure.
- Add stack detection.
- Add tests around CLI flags.
- Improve prompt fixtures.
- Document real-world workflows.
- Add examples for a specific frontend stack.

## Development

```bash
npm install
npx playwright install chromium
npm run check
```

`npm run check` also validates the composite GitHub Action metadata so CI usage stays aligned with the CLI safety model.

Run the CLI locally:

```bash
npm run dev -- init
npm run dev -- plan
```

## Verification Before Pull Requests

Run the root check, then verify the example app that CI uses as the end-to-end smoke test:

```bash
npm run check
npm run pack:dry-run
npm run pack:smoke
npm run smoke:live
cd examples/react-vite-dashboard
npm ci
npm audit --audit-level=low
npm run build
DEVFLOW_AI_FIXTURE_PATH=fixtures/patch-set-ai-applied.json \
  node ../../dist/cli.js deliver --apply --yes --unit U18
```

The live smoke command is optional for normal contributors. It skips without `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY`, writes `.devflow/artifacts/live-provider-smoke.json`, and maintainers can set `DEVFLOW_REQUIRE_LIVE_SMOKE=true` when they want missing live credentials to fail a release gate.

For changes that affect delivery, also run the example with a preview server and the DevFlow orchestrator:

```bash
npm run dev -- --host 127.0.0.1
node ../../dist/cli.js deliver \
  --requirements docs/requirements.md \
  --ui docs/ui.md \
  --api docs/api.md \
  --preview-url http://127.0.0.1:5173 \
  --visual-text OpsBoard,Checkout
```

CI runs this same flow and uploads `.devflow/artifacts` for inspection when a job fails.

When testing source-changing delivery locally, use a reviewed patch set and keep the confirmation explicit:

```bash
cd examples/react-vite-dashboard
node ../../dist/cli.js deliver \
  --apply \
  --yes \
  --require-clean \
  --patch-set fixtures/patch-set-ai-applied.json
```

## Design Principles For Contributions

- Prefer small, reviewable changes.
- Keep provider-specific code behind an interface.
- Keep generated artifacts human-readable.
- Do not require a paid AI provider for local tests.
- Add verification when changing workflow behavior.
- Keep CI green with deterministic fallbacks or fixture-backed AI responses.
- Cover provider integrations with local protocol tests before requiring live model credentials.

## Release Readiness

Release-oriented changes should also follow the checklist in `docs/release.md`. At minimum, keep `CHANGELOG.md` current and confirm `npm run pack:dry-run` contains only publishable artifacts.

## Commit Style

Use clear commit messages:

```text
feat: add stack detector
fix: preserve custom config paths during init
docs: expand roadmap
```
