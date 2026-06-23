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

This repository currently contains the first MVP slice: a CLI that initializes a DevFlow workspace, creates a structured project brief, detects repository stack signals, generates an implementation plan, produces scoped task/proposal artifacts, runs verification, captures optional visual checks, and writes a delivery report from local documents.

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

The smoke script copies `examples/react-vite-dashboard` into `.devflow/example-smoke/`, builds it, runs non-destructive delivery, replays a fixture-backed AI patch set, applies that patch set, and verifies that a delivery report was generated.

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
- API endpoint contracts extracted from HTTP method/path references.
- API data models extracted from fenced `json` examples.
- API error cases and authentication requirements extracted from API docs.
- Fenced OpenAPI JSON/YAML support for `paths`, component schemas, request/response schemas, error responses, and security schemes.
- Detected package manager, runtime, frameworks, build tools, styling, testing, scripts, source directories, and config files.
- Acceptance criteria, delivery risk assessment, and open questions.
- Recommended verification commands.

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

It also includes implementation units derived from user stories, requirement constraints, requirement signals, UI signals, UI state checklist items, design assets, API endpoints, API data models, API error cases, and API auth requirements so coding agents can target smaller pieces of work.

### `dev-flow execute`

The safest path is dry-run first:

```bash
dev-flow execute --dry-run
dev-flow execute --dry-run --task T03-code-implementation
dev-flow execute --dry-run --unit U18
dev-flow execute --dry-run --no-source-context
```

Dry-run execution writes reviewable patch proposal documents to `.devflow/artifacts/patch-proposals/` without changing source files.

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

Patch sets support `write`, `replace`, and guarded `delete` operations. Applied patch sets are recorded in `.devflow/artifacts/execution-log.json`.

Use `execute --validate --patch-set <path>` to check a reviewed or AI-generated patch set without changing source files, creating backups, or writing the execution log.

The machine-readable patch-set JSON Schema lives at `schemas/patch-set.schema.json`; see [Patch Set Schema](docs/patch-set-schema.md).

Patch-set validation keeps AI-generated changes reviewable: a patch set can include at most 50 operations, each write or replacement is capped at 500,000 bytes, and each replace search string is capped at 100,000 bytes. Delete operations still require safe relative paths and are included in apply backups.

Each apply creates a backup manifest under `.devflow/artifacts/backups/`. If an apply fails after partial writes, DevFlow restores that backup automatically and writes `.devflow/artifacts/rollback-report.json`. Use `execute --rollback --backup <manifest>` to restore files from a backup manually.

### `dev-flow deliver`

Runs the safe delivery flow:

```bash
dev-flow deliver --requirements docs/requirements.md --ui docs/ui.md --api docs/api.md
```

With a running preview server, include visual checks:

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

Reads the project brief, runs recommended verification commands, and writes `.devflow/artifacts/verification-report.json`.

Override the command when needed:

```bash
dev-flow verify --command "npm run check"
```

### `dev-flow report`

Reads DevFlow artifacts and writes `.devflow/artifacts/delivery-report.md`.

The report includes source documents, user stories, requirement constraints, acceptance criteria, per-criterion delivery evidence, known gaps, assumptions, manual QA prompts, UI state checklist items, risk assessment, detected stack, design asset details, artifact paths, applied patch summaries, backup manifests, verification status, visual checks, delivery readiness, open questions, and next actions.

Use `--visual-report none` when generating a report that should not include an existing visual artifact from an earlier run:

```bash
dev-flow report --visual-report none
```

### `dev-flow visual`

Captures screenshots, blank-screen checks, layout-overflow checks, and optional text checks for a running preview URL:

```bash
dev-flow visual --url http://127.0.0.1:5173 --text OpsBoard,Checkout
```

By default, DevFlow captures desktop and tablet screenshots in `.devflow/artifacts/visual/` and writes `.devflow/artifacts/visual/visual-report.json` with pixel-level blank-screen analysis and basic layout issue detection.

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

The action defaults to non-destructive `dev-flow deliver`. Source-changing delivery requires both `apply: "true"` and `confirm-apply: "true"`.

See [GitHub Action](docs/github-action.md) for artifact uploads, visual checks, AI provider environment variables, fixture-backed CI, and reviewed patch-set examples.

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
- Stack detection for package manager, framework, build, styling, testing, scripts, and source layout.
- Structured project brief output with user stories, constraints, acceptance criteria, and downstream planning context.
- UI state checklist extraction from UI notes for screens, components, visual states, interactions, responsive behavior, and accessibility checks.
- Delivery risk scoring for ambiguous requirements, missing UI/API detail, missing verification commands, and unresolved project gates.
- OpenAI-compatible provider abstraction.
- Deterministic fallback planner for offline use.
- Generated implementation plan with phases, risks, and verification checklist.
- Generated task plan for implementation phases and structured implementation units.
- AI-assisted dry-run patch proposals for review before source-changing execution.
- Stack-specific target profiles and bounded source-context sampling in AI prompts, including component, data, style, test, config, and verification candidates.
- Source context privacy controls through `--no-source-context` and `DEVFLOW_SOURCE_CONTEXT=none`.
- Validated patch-set application with write, replace, delete, execution logs, and rollback.
- Validate-only patch-set checks for reviewed or AI-generated patch sets before source-changing apply.
- Patch-set size limits for operation count, write content, and replace payloads.
- Automatic backup restoration when patch-set application fails after partial writes.
- Verification report generated from project commands.
- Visual report with screenshots, blank-screen checks, layout-overflow checks, and optional text checks for preview URLs.
- Delivery report generated from DevFlow artifacts, including acceptance criteria, per-criterion delivery evidence, known gaps, assumptions, manual QA prompts, UI state checklist items, risk assessment, delivery readiness, touched files, operation counts, backup counts, and line-count deltas when patch sets are applied.
- Safe `deliver` orchestration command for non-destructive and explicitly approved source-changing flows.
- Composite GitHub Action for running safe delivery in CI.
- Clean extension points for future coding agents.

## Future Direction

Planned capabilities:

- Interpret design assets beyond lightweight Markdown/image metadata, including Figma exports, screenshots, and structured design notes with multimodal models.
- Continue expanding stack-specific route/component/data-fetching tasks beyond the initial target profiles.
- Add interactive approvals and safer review UX around source-changing patch sets.
- Expand visual verification beyond screenshots, text checks, blank-screen detection, and basic layout-overflow checks.
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
