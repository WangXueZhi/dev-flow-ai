# DevFlow

DevFlow is an open-source AI workflow for frontend delivery. It helps developers turn product requirements, UI design notes, and API documentation into an implementation plan, then gradually into code, verification, and a delivery report.

The long-term goal is simple:

> Give every frontend developer an AI teammate that can understand context before coding, work inside the repository, verify its own changes, and ship a reviewable result.

## Why This Project Exists

Modern AI coding tools are powerful, but frontend delivery usually starts before code:

- Product requirements describe goals, user stories, edge cases, roles, constraints, and acceptance criteria.
- UI files define layout, states, interaction details, and visual constraints.
- API documentation defines data contracts, error cases, auth, and integration boundaries.
- Existing repositories have conventions that generated code must respect.

DevFlow treats these inputs as first-class context. Instead of jumping straight from a prompt to code, it builds a structured workflow:

1. Collect project context.
2. Normalize requirements, UI notes, and API docs.
3. Produce an implementation plan with risks and acceptance checks.
4. Execute scoped coding tasks.
5. Run verification.
6. Generate a delivery report.

This repository currently contains the first MVP slice: a CLI that initializes a DevFlow workspace, creates a structured project brief, detects repository stack signals, generates an implementation plan, produces scoped task/proposal artifacts, runs verification, captures optional visual checks, and writes human-readable plus machine-readable delivery reports from local documents.

## Quick Start

Until the first npm release is published, install the CLI directly from GitHub:

```bash
npm install --global github:WangXueZhi/dev-flow-ai
dev-flow help
dev-flow --version
```

Maintainers can verify the pre-release GitHub install path without touching global packages:

```bash
npm run github:smoke
```

For local development from a clone:

```bash
npm install
npm run build
node dist/cli.js init
node dist/cli.js brief
node dist/cli.js plan
node dist/cli.js tasks
node dist/cli.js execute --dry-run
node dist/cli.js verify
node dist/cli.js report
node dist/cli.js deliver
```

To see the full MVP loop on a disposable copy of the included React/Vite example, run:

```bash
npm run example:smoke
```

The smoke script copies `examples/react-vite-dashboard` into `.devflow/example-smoke/`, builds it, runs non-destructive delivery, replays a fixture-backed AI patch set, applies that patch set, and verifies that the delivery report plus `dev-flow status` summary were generated from the manifest.

After `init`, edit these files:

- `docs/requirements.md`
- `docs/ui.md`
- `docs/api.md`

Then run:

```bash
node dist/cli.js brief --out .devflow/artifacts/project-brief.json
node dist/cli.js plan --out .devflow/artifacts/implementation-plan.md
node dist/cli.js tasks --out .devflow/artifacts/tasks.json
node dist/cli.js execute --dry-run --out .devflow/artifacts/patch-proposals
node dist/cli.js verify --out .devflow/artifacts/verification-report.json
node dist/cli.js report --out .devflow/artifacts/delivery-report.md
node dist/cli.js deliver --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
```

`dev-flow report` also writes `.devflow/artifacts/delivery-manifest.json` by default so CI jobs, editors, and downstream tools can index the delivery artifacts without scraping Markdown.

## Optional AI Provider

DevFlow can call an OpenAI-compatible chat completions endpoint when the following environment variables are present:

```bash
export DEVFLOW_AI_API_KEY="..."
# Or use OPENAI_API_KEY when DEVFLOW_AI_API_KEY is not set.
export DEVFLOW_AI_BASE_URL="https://api.openai.com/v1"
export DEVFLOW_AI_MODEL="gpt-4.1"
```

Without an API key, `dev-flow plan` and `dev-flow execute --dry-run` fall back to deterministic local output. That fallback is intentionally useful for development and tests, but the AI path is where richer implementation plans and patch proposals come from.

When a live provider is configured, execution prompts may include bounded snippets of existing repository files selected from the target profile. To use an AI provider without sending sampled source snippets, pass `--no-source-context` to `dev-flow execute` or `dev-flow deliver`, or set:

```bash
export DEVFLOW_SOURCE_CONTEXT=none
```

Requirements, UI notes, API docs, project brief, task plan, and target profile context are still included; only sampled repository source snippets are omitted.

For reproducible tests or CI without a live model, point `DEVFLOW_AI_FIXTURE_PATH` at a file containing the model response to replay:

```bash
DEVFLOW_AI_FIXTURE_PATH=fixtures/patch-set.json dev-flow execute --apply --task T03-code-implementation
```

To verify a real provider before a release or demo, run the optional live smoke test after building:

```bash
npm run build
DEVFLOW_AI_API_KEY="..." npm run smoke:live
```

Without `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY`, the live smoke command prints a skip message and exits successfully. Set `DEVFLOW_REQUIRE_LIVE_SMOKE=true` when a release process should fail if live credentials are missing.

## CLI Commands

```bash
dev-flow init
dev-flow brief
dev-flow plan
dev-flow tasks
dev-flow execute --dry-run
dev-flow execute --apply
dev-flow execute --validate
dev-flow deliver
dev-flow verify
dev-flow visual
dev-flow report
dev-flow status
dev-flow doctor
dev-flow version
```

### `dev-flow init`

Creates the local project context:

- `.devflow/config.json`
- `.devflow/artifacts/`
- `docs/requirements.md` with goal, roles, scope, acceptance criteria, constraints, and verification notes
- `docs/ui.md` with design asset links, screens, components, states, interactions, responsive behavior, accessibility, and visual tokens
- `docs/api.md` with auth, endpoints, JSON data models, error cases, loading/cache notes, and an OpenAPI JSON/YAML placeholder

Existing handoff documents are preserved. `init` creates missing starter files and reports how many starter docs were created or already existed.

### `dev-flow plan`

Reads the configured input documents, writes `.devflow/artifacts/project-brief.json`, and writes an implementation plan.

The plan includes a `Frontend Delivery Blueprint` with explicit sections for routes and navigation, components, state and interaction, data and API integration, styling and responsive rules, test planning, and accessibility checks.

When an AI provider returns content that looks like a patch-set JSON response in the planner slot, DevFlow falls back to the local planner so `.devflow/artifacts/implementation-plan.md` remains a usable plan. Provider plans that omit the blueprint keep their AI-authored content and receive a generated blueprint appendix.

Useful flags:

```bash
dev-flow plan --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md --out .devflow/artifacts/implementation-plan.md
```

### `dev-flow brief`

Reads the configured input documents, detects repository stack signals, and writes a structured project brief as JSON.

The brief includes:

- Source document paths.
- Extracted requirement, UI, and API signals.
- User stories, requirement constraints, and acceptance criteria extracted from requirements.
- UI design assets referenced from Markdown image links, including local file existence, SVG structure/text/color metadata, and PNG/JPEG dimensions for local assets.
- UI state checklist items extracted from screens, components, states, interactions, responsive behavior, accessibility sections, and state-related UI keywords.
- Normalized frontend targets for routes/views, components, data needs, and UI states, including explicit route paths, component names, and targets derived from acceptance criteria.
- API endpoint contracts extracted from HTTP method/path references.
- API data models extracted from fenced `json` examples.
- API error cases and authentication requirements extracted from API docs.
- Fenced OpenAPI JSON/YAML support for `paths`, component schemas, request/response schemas, error responses, and security schemes.
- Detected package manager, runtime, frameworks, build tools, styling, testing, scripts, source directories, and config files, including common frontend config conventions when dependency metadata is incomplete.
- Acceptance criteria, delivery risk assessment, and open questions.
- Recommended verification commands from package scripts, common script aliases, or inferred TypeScript, test, and build tooling.

### `dev-flow doctor`

Checks installed DevFlow version, local runtime, config, document presence, Playwright Chromium readiness, and AI provider environment variables.

For machine-readable diagnostics:

```bash
dev-flow doctor --json
```

Doctor output also reports whether sampled repository source snippets are enabled for AI prompts. Use `DEVFLOW_SOURCE_CONTEXT=none dev-flow doctor --json` to verify a privacy-oriented environment.

### `dev-flow tasks`

Reads the project brief and implementation plan, then writes:

- `.devflow/artifacts/tasks.json`
- `.devflow/artifacts/tasks.md`

The task plan splits delivery into discovery, planning, implementation, verification, and delivery phases.

It also includes normalized frontend targets plus implementation units derived from user stories, acceptance criteria, requirement constraints, requirement signals, UI signals, UI state checklist items, design assets, API endpoints, API data models, API error cases, and API auth requirements so coding agents can target smaller pieces of work.

### `dev-flow execute`

The safest path is dry-run first:

```bash
dev-flow execute --dry-run
dev-flow execute --dry-run --task T03-code-implementation
dev-flow execute --dry-run --unit U18
dev-flow execute --dry-run --no-source-context
```

Dry-run execution writes reviewable patch proposal documents to `.devflow/artifacts/patch-proposals/` without changing source files. Proposals surface UI checklist coverage and delivery risks from the project brief so reviewers can see state, responsive, accessibility, and ambiguity constraints before source-changing execution.

Use `--unit <id>` to focus execution on one implementation unit from `.devflow/artifacts/tasks.json`. When `--unit` is provided without `--task`, DevFlow scopes the proposal to `T03-code-implementation` by default.

When an AI provider is configured through `DEVFLOW_AI_API_KEY`, `OPENAI_API_KEY`, or `DEVFLOW_AI_FIXTURE_PATH`, dry-run execution asks the provider for a task-specific implementation proposal grounded in the project brief, task plan, target profile, and sampled repository source context. Without a provider, it uses a deterministic local proposal template.

Source-changing execution is available through validated patch sets:

```bash
dev-flow execute --validate --patch-set path/to/patch-set.json
dev-flow execute --apply --patch-set path/to/patch-set.json
dev-flow execute --apply --task T03-code-implementation
dev-flow execute --apply --task T03-code-implementation --unit U18
dev-flow execute --apply --task T03-code-implementation --no-source-context
dev-flow execute --rollback --backup .devflow/artifacts/backups/<id>/manifest.json
```

When an AI provider is configured, `dev-flow execute --apply --task <id>` can ask the provider for a strict JSON patch set grounded in sampled repository source context and apply it after path validation. Without a provider, `--apply` requires `--patch-set`.

AI-generated patch sets are saved to `.devflow/artifacts/patch-sets/<task>.json` by default. Use `--save-patch-set <path>` to choose a different location.

Patch sets support `write`, `replace`, and guarded `delete` operations. Applied patch sets are recorded in `.devflow/artifacts/execution-log.json` and summarized for handoff in `.devflow/artifacts/task-changelog.md`.

Use `execute --validate --patch-set <path>` to check a reviewed or AI-generated patch set without changing source files, creating backups, or writing the execution log.

The machine-readable patch-set JSON Schema lives at `schemas/patch-set.schema.json`; see [Patch Set Schema](docs/patch-set-schema.md).

Patch-set validation keeps AI-generated changes reviewable: a patch set can include at most 50 operations, each write or replacement is capped at 500,000 bytes, and each replace search string is capped at 100,000 bytes. Delete operations still require safe relative paths and are included in apply backups.

Each apply creates a backup manifest under `.devflow/artifacts/backups/`. If an apply fails after partial writes, DevFlow restores that backup automatically and writes `.devflow/artifacts/rollback-report.json`. Use `execute --rollback --backup <manifest>` to restore files from a backup manually.

### `dev-flow deliver`

Runs the safe delivery flow:

```bash
dev-flow deliver --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
```

With a running preview server, include visual checks. When `--visual-text` is omitted, `deliver` infers short required text checks from design asset text snippets and UI state labels in the project brief:

```bash
dev-flow deliver --preview-url http://127.0.0.1:5173 --visual-text OpsBoard,Checkout
```

For a focused delivery pass, target one implementation unit from `.devflow/artifacts/tasks.json`:

```bash
dev-flow deliver --unit U18
```

When `--unit` is provided without `--task`, DevFlow scopes the dry-run proposal to `T03-code-implementation` by default.

The command runs planning, task generation, dry-run proposals, verification, optional visual screenshots, and final report generation.

For source-changing delivery, keep the dry-run artifact and opt in explicitly:

```bash
dev-flow deliver --apply --yes --task T03-code-implementation
dev-flow deliver --apply --yes --unit U18
dev-flow deliver --apply --yes --patch-set .devflow/artifacts/patch-sets/reviewed.json
dev-flow deliver --apply --yes --task T03-code-implementation --no-source-context
```

`deliver --apply` runs the same plan, tasks, and dry-run proposal steps first, then applies either an AI-generated task/unit patch set or a reviewed local patch set before verification, visual checks, and the final report. The `--yes` flag is required so CI and local scripts cannot modify source files by accident.

### `dev-flow verify`

Reads the project brief, runs recommended verification commands, and writes `.devflow/artifacts/verification-report.json`. Recommended commands are derived from detected package scripts in `check`, `lint`, `typecheck`, `test`, and `build` order, including common script aliases such as `validate`, `type-check`, `test:unit`, and `compile`. When explicit verification scripts are missing, DevFlow can infer package-manager-aware commands from detected TypeScript, Vitest, Jest, Playwright, Cypress, Vite, Next.js, Nuxt, Astro, or Angular signals.

Override the command when needed:

```bash
dev-flow verify --command "npm run check"
```

### `dev-flow report`

Reads DevFlow artifacts and writes `.devflow/artifacts/delivery-report.md` plus `.devflow/artifacts/delivery-manifest.json`.

The report includes source documents, user stories, requirement constraints, acceptance criteria, per-criterion delivery evidence, known gaps, assumptions, manual QA prompts, UI state checklist items, risk assessment, detected stack, design asset details, artifact paths, applied patch summaries, backup manifests, verification status with bounded failure excerpts, visual checks with embedded screenshots when available, delivery readiness, open questions, and next actions.

The manifest is JSON. It records artifact paths and statuses, delivery readiness, verification and visual status, source-change status, acceptance evidence, touched files, backup manifests, screenshots, required text checks, bounded verification failure excerpts, open questions, and delivery risk counts. Use `--manifest-out <path>` to write it somewhere else:

```bash
dev-flow report --manifest-out .devflow/artifacts/review/delivery-manifest.json
```

The public schema is available at `schemas/delivery-manifest.schema.json`, with details in `docs/delivery-manifest-schema.md`.

Use `--visual-report none` when generating a report that should not include an existing visual artifact from an earlier run:

```bash
dev-flow report --visual-report none
```

### `dev-flow status`

Reads `.devflow/artifacts/delivery-manifest.json` and prints a compact delivery status summary:

```bash
dev-flow status
dev-flow status --json
dev-flow status --manifest .devflow/artifacts/review/delivery-manifest.json
dev-flow status --fail-on-attention
dev-flow status --fail-on-failed-verification
```

Use it when local scripts, CI logs, or reviewers need readiness, verification, visual, source-change, artifact, verification-failure, risk, and open-question status without opening the Markdown report.

Use `--fail-on-attention` in CI when any delivery readiness blocker should fail the job. Use `--fail-on-failed-verification` when a failed verification report should return a non-zero exit code while still printing the status summary or JSON manifest.

### `dev-flow visual`

Captures screenshots, blank-screen checks, layout issue checks, and optional text checks for a running preview URL:

```bash
dev-flow visual --url http://127.0.0.1:5173 --text OpsBoard,Checkout
```

`dev-flow visual` only uses explicit `--text` values. `dev-flow deliver --preview-url <url>` can infer default text checks from the project brief when no explicit `--visual-text` or `--text` value is provided.

By default, DevFlow captures desktop, tablet, and mobile screenshots in `.devflow/artifacts/visual/` and writes `.devflow/artifacts/visual/visual-report.json` with pixel-level blank-screen analysis and basic layout issue detection.

Visual checks require a local Playwright Chromium browser. If `dev-flow doctor` reports it missing, install it with:

```bash
npx playwright install chromium
```

## GitHub Action

DevFlow includes a composite GitHub Action for CI usage:

```yaml
- uses: WangXueZhi/dev-flow-ai@main
  with:
    requirements: docs/requirements.md
    ui: docs/ui.md
    api: docs/api.md
```

Use `WangXueZhi/dev-flow-ai@v0.1.0` after the first release tag is published.

The action defaults to non-destructive `dev-flow deliver`. Source-changing delivery requires both `apply: "true"` and `confirm-apply: "true"`. CI workflows can also enable manifest-backed gates with `fail-on-attention: "true"` and `fail-on-failed-verification: "true"`.

See [GitHub Action](docs/github-action.md) for artifact uploads, status gates, visual checks, AI provider environment variables, fixture-backed CI, and reviewed patch-set examples.

## CI And Local Verification

GitHub Actions runs the same core checks contributors should run before opening a pull request:

```bash
npm run check
npm run pack:dry-run
npm run pack:smoke
npm run github:smoke
npm run example:smoke
npm run smoke:live
npm run release:preflight
cd examples/react-vite-dashboard
npm ci
npm audit --audit-level=low
npm run build
```

The live smoke command is optional and skips without provider credentials. The CI workflow also verifies the npm package dry-run, runs fixture-backed source-changing delivery on the React/Vite example, starts the example preview, runs `dev-flow deliver` with visual text, blank-screen, and layout checks, and uploads DevFlow artifacts for review.

Publishing is handled by the Release workflow in `.github/workflows/release.yml`. It runs the package checks and smoke tests, then publishes to npm with provenance when `NPM_TOKEN` is configured.

## MVP Scope

The first public milestone focuses on planning quality and repository ergonomics:

- Local CLI that works in any frontend repository.
- Document ingestion for requirements, UI notes, and API docs.
- UI design asset references extracted from Markdown image links, including local existence checks, SVG width, height, viewBox, title, description, color swatches, and text snippets, plus PNG/JPEG dimensions.
- API endpoint contracts extracted from API docs.
- API data model summaries extracted from fenced `json` examples.
- API error and auth requirement summaries extracted from API docs.
- OpenAPI JSON/YAML `paths`, component schemas, request/response schemas, error responses, and security schemes extracted from fenced `json`, `yaml`, or `yml` blocks.
- Stack detection for package manager metadata, framework, build, styling, testing, scripts, source layout, and common frontend config conventions.
- Structured project brief output with user stories, constraints, acceptance criteria, and downstream planning context.
- Aggregated recommended verification commands from detected `check`, `lint`, `typecheck`, `test`, and `build` package scripts, common aliases, or inferred TypeScript, test, and build tooling.
- UI state checklist extraction from UI notes for screens, components, visual states, interactions, responsive behavior, and accessibility checks.
- Normalized frontend target extraction for routes/views, explicit route paths, component names, data needs, UI states, and acceptance criteria.
- Delivery risk scoring for ambiguous requirements, missing UI/API detail, missing verification commands, and unresolved project gates.
- OpenAI-compatible provider abstraction.
- Deterministic fallback planner for offline use.
- Planner guardrails that keep patch-set JSON out of implementation-plan artifacts and add missing frontend blueprint sections to provider plans.
- Generated implementation plan with phases, risks, structured frontend delivery blueprint sections, and verification checklist.
- Generated task plan for implementation phases, normalized frontend targets derived from requirements, acceptance criteria, UI notes, design assets, and API docs, and structured implementation units.
- AI-assisted dry-run patch proposals for review before source-changing execution, including UI checklist coverage and delivery risk summaries.
- Stack-specific target profiles and bounded source-context sampling in AI prompts, including normalized frontend targets plus component, data, style, test, config, and verification candidates, with Nuxt, Svelte/SvelteKit, Astro, and Angular-aware route/data/style/test targeting.
- Source context privacy controls through `--no-source-context` and `DEVFLOW_SOURCE_CONTEXT=none`.
- Validated patch-set application with write, replace, delete, execution logs, task changelogs, and rollback.
- Validate-only patch-set checks for reviewed or AI-generated patch sets before source-changing apply.
- Patch-set size limits for operation count, write content, and replace payloads.
- Automatic backup restoration when patch-set application fails after partial writes.
- Verification report generated from project commands.
- Visual report with screenshots, blank-screen checks, layout issue checks for overflow, clipped text, and overlapping visible elements, optional text checks for preview URLs, and inferred `deliver` text checks from design/UI brief context.
- Delivery report and machine-readable delivery manifest generated from DevFlow artifacts, including acceptance criteria, per-criterion delivery evidence, known gaps, assumptions, manual QA prompts, UI state checklist items, risk assessment, embedded visual screenshots, artifact statuses, delivery readiness, verification failure excerpts, touched files, operation counts, backup counts, and line-count deltas when patch sets are applied.
- Local delivery status summary command backed by the delivery manifest.
- Published JSON schemas for reviewed patch sets and delivery manifests.
- Safe `deliver` orchestration command for non-destructive and explicitly approved source-changing flows.
- Composite GitHub Action for running safe delivery in CI, uploading artifacts, writing a delivery summary from the manifest, and gating readiness or failed verification.
- Clean extension points for future coding agents.

## Future Direction

Planned capabilities:

- Interpret design assets beyond lightweight Markdown/image metadata, including Figma exports, screenshots, and structured design notes with multimodal models.
- Continue expanding stack-specific route/component/data-fetching tasks beyond the normalized frontend targets and initial target profiles.
- Add interactive approvals and safer review UX around source-changing patch sets.
- Expand visual verification beyond screenshots, text checks, blank-screen detection, and basic layout issue checks.
- Continue expanding final delivery reports with richer reviewer notes, screenshots, and known risks.
- Support multiple AI providers and local models.
- Provide reusable workflow plugins for React, Vue, Next.js, Vite, and design systems.

## Examples

- [React Vite Dashboard](examples/react-vite-dashboard): a working OpsBoard dashboard with requirements, UI notes, API docs, and a production build.

## Project Docs

- [Product Vision](docs/product.md)
- [Adoption Guide](docs/adoption.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](docs/contributing.md)
- [Release Guide](docs/release.md)
- [GitHub Action](docs/github-action.md)
- [Patch Set Schema](docs/patch-set-schema.md)
- [Changelog](CHANGELOG.md)
- [Code Of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

MIT
