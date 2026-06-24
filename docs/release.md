# Release Guide

DevFlow releases should be boring, reproducible, and easy to inspect.

## Before Release

Run the root checks:

```bash
npm ci
npx playwright install chromium
npm run release:readiness
npm run release:preflight
```

`npm run release:readiness` runs static release checks for package/package-lock version alignment, changelog coverage, versioned release notes, package allowlists, npm provenance workflow configuration, and live-provider gate documentation.

`npm run release:preflight` runs release readiness, the package checks, installed package smoke, GitHub install smoke, example delivery smoke, manifest-backed status smoke, optional live provider smoke, and a local `.env`, `.env.*` except `.env.example`, and `.tgz` residue check.

`npm run smoke:live` writes `.devflow/artifacts/live-provider-smoke.json` and skips when no live provider key is configured. For a release gate that must verify the real provider path, run the preflight with `DEVFLOW_REQUIRE_LIVE_SMOKE=true` plus `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY`. Set `DEVFLOW_LIVE_SMOKE_REPORT=<path>` when CI should store the JSON report in a custom artifact location. The Release workflow fixes this path and uploads it with the `Upload live provider smoke report` workflow artifact, even when the smoke step fails, so maintainers can inspect skipped, failed, and passed live-smoke evidence.

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
- Confirm the repository has `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY` configured before publishing a GitHub Release.
- Confirm `dev-flow doctor --json` reports the expected provider endpoint, model, key source, and fixture override state without exposing secret values.
- Confirm `dev-flow doctor` reports Playwright Chromium readiness before visual checks.
- Confirm `npm run release:readiness` passes.
- Confirm `npm run release:preflight` passes.
- Confirm `npm run pack:dry-run` includes `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `scripts/release-readiness.mjs`, `scripts/live-provider-smoke.mjs`, and `scripts/summarize-manifest.mjs`.
- Confirm `schemas/patch-set.schema.json` is included in the npm package.
- Confirm `npm run pack:smoke` installs the tarball in a temporary project and runs `dev-flow help/init`.
- Confirm `npm run github:smoke` installs the GitHub package spec in a temporary project before the first npm release.
- Confirm `npm run smoke:live` has either passed against a real provider or intentionally skipped for a non-live release, and archive `.devflow/artifacts/live-provider-smoke.json` with the release evidence.
- Confirm the Release workflow uploads the `live-provider-smoke-report` artifact containing `.devflow/artifacts/live-provider-smoke.json`.
- Confirm no secrets or local `.env`/`.env.*` files, except `.env.example`, are included in the package.
- Tag the release after CI passes.

## GitHub Release Workflow

The repository includes `.github/workflows/release.yml` for npm publishing. It runs on GitHub Release publication or manual `workflow_dispatch`.

The workflow:

- Installs dependencies with `npm ci`.
- Runs `npm run release:readiness`.
- Runs `npm run check`.
- Runs `npm run pack:dry-run`.
- Runs `npm run pack:smoke`.
- Runs `npm run github:smoke`.
- Runs `npm run example:smoke`, including manifest-backed `dev-flow status` checks.
- Runs optional `npm run smoke:live` for manual dispatch unless `require_live_smoke` is `"true"`.
- Requires `npm run smoke:live` with `DEVFLOW_REQUIRE_LIVE_SMOKE=true` when a GitHub Release is published.
- Uploads `.devflow/artifacts/live-provider-smoke.json` as the `live-provider-smoke-report` workflow artifact with `if: always()`.
- Checks that the `NPM_TOKEN` repository secret is configured before publish.
- Publishes with `npm publish --provenance --access public`.

Required repository setup:

- Add an `NPM_TOKEN` repository secret with publish rights.
- Add `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY` as a repository secret before publishing a GitHub Release so the required live provider smoke can pass.
- Keep workflow permissions `contents: read` and `id-token: write` so npm provenance can be attached.
- Use the manual `npm_tag` input only when publishing a non-`latest` dist-tag.
- Use the manual `require_live_smoke` input when testing the release workflow before publishing the GitHub Release.

## Current Release Boundary

The MVP preview is suitable for local workflow trials, examples, and contributor development. Live model quality still depends on the configured OpenAI-compatible provider and should be validated against a real frontend repository before a production rollout.

Draft release notes for the first public release live in `docs/releases/v0.1.0.md`.
