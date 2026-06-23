# Release Guide

DevFlow releases should be boring, reproducible, and easy to inspect.

## Before Release

Run the root checks:

```bash
npm ci
npx playwright install chromium
npm run check
npm run pack:dry-run
npm run pack:smoke
npm run github:smoke
npm run example:smoke
npm run smoke:live
```

`npm run smoke:live` skips when no live provider key is configured. For a release gate that must verify the real provider path, run it with `DEVFLOW_REQUIRE_LIVE_SMOKE=true` plus `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY`.

Run the React/Vite example smoke test:

```bash
cd examples/react-vite-dashboard
npm ci
npm audit --audit-level=low
npm run build
node ../../dist/cli.js execute --validate --patch-set fixtures/patch-set-ai-applied.json
DEVFLOW_AI_FIXTURE_PATH=fixtures/patch-set-ai-applied.json \
  node ../../dist/cli.js deliver \
  --apply \
  --yes \
  --unit U18 \
  --requirements docs/requirements.md \
  --ui docs/ui.md \
  --api docs/api.md
```

With a preview server running, verify the delivery flow:

```bash
npm run dev -- --host 127.0.0.1
node ../../dist/cli.js execute --validate --patch-set fixtures/patch-set-ai-applied.json
node ../../dist/cli.js deliver \
  --apply \
  --yes \
  --patch-set fixtures/patch-set-ai-applied.json \
  --requirements docs/requirements.md \
  --ui docs/ui.md \
  --api docs/api.md \
  --preview-url http://127.0.0.1:5173 \
  --visual-text OpsBoard,Checkout,"AI applied"
```

## Release Checklist

- Confirm `CHANGELOG.md` describes the user-facing changes.
- Confirm `README.md` matches the current CLI behavior.
- Confirm `docs/github-action.md` and `action.yml` match the current safe delivery behavior.
- Confirm the repository has an `NPM_TOKEN` secret with publish rights for `dev-flow-ai`.
- Confirm `dev-flow doctor` reports Playwright Chromium readiness before visual checks.
- Confirm `npm run pack:dry-run` includes `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `scripts/live-provider-smoke.mjs`.
- Confirm `npm run pack:smoke` installs the tarball in a temporary project and runs `dev-flow help/init`.
- Confirm `npm run github:smoke` installs the GitHub package spec in a temporary project before the first npm release.
- Confirm `npm run smoke:live` has either passed against a real provider or intentionally skipped for a non-live release.
- Confirm no secrets or local `.env` files are included in the package.
- Tag the release after CI passes.

## GitHub Release Workflow

The repository includes `.github/workflows/release.yml` for npm publishing. It runs on GitHub Release publication or manual `workflow_dispatch`.

The workflow:

- Installs dependencies with `npm ci`.
- Runs `npm run check`.
- Runs `npm run pack:dry-run`.
- Runs `npm run pack:smoke`.
- Runs `npm run github:smoke`.
- Runs `npm run example:smoke`.
- Runs optional `npm run smoke:live`.
- Checks that the `NPM_TOKEN` repository secret is configured before publish.
- Publishes with `npm publish --provenance --access public`.

Required repository setup:

- Add an `NPM_TOKEN` repository secret with publish rights.
- Keep workflow permissions `contents: read` and `id-token: write` so npm provenance can be attached.
- Use the manual `npm_tag` input only when publishing a non-`latest` dist-tag.

## Current Release Boundary

The MVP preview is suitable for local workflow trials, examples, and contributor development. Live model quality still depends on the configured OpenAI-compatible provider and should be validated against a real frontend repository before a production rollout.

Draft release notes for the first public release live in `docs/releases/v0.1.0.md`.
