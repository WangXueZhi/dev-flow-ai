# Requirements

DevFlow MVP should help frontend developers convert requirements, UI notes, and API docs into a concrete implementation plan before coding.

## Goal

Create a local-first open-source CLI that can run inside any frontend repository and produce a reviewable plan from project documents.

## User Stories

- As a frontend developer, I want to initialize a DevFlow workspace so that project context has a predictable location.
- As a frontend developer, I want to provide requirements, UI notes, and API docs so that AI output is grounded in real delivery context.
- As a frontend developer, I want DevFlow to detect my repository stack so that plans follow local conventions.
- As a frontend developer, I want a structured project brief so that planning and execution use the same source of truth.
- As a frontend developer, I want to generate an implementation plan so that I can review scope, phases, risks, and verification steps before code changes.
- As a frontend developer, I want DevFlow to split the plan into implementation tasks so that AI work is scoped and reviewable.
- As a frontend developer, I want dry-run patch proposals so that I can review planned changes before source files are modified.
- As a frontend developer, I want DevFlow to run recommended checks so that delivery quality is recorded.
- As a frontend developer, I want a delivery report so that I can hand off what was planned, verified, and still needs review.
- As an open-source contributor, I want the project to work without a paid AI key so that tests and local development are accessible.
- As a tool maintainer, I want AI provider code behind a small interface so that future providers can be added safely.

## Acceptance Criteria

- [ ] `dev-flow init` creates `.devflow/config.json`, `.devflow/artifacts/`, and structured starter document files for requirements, UI notes, and API docs.
- [ ] `dev-flow brief` writes `.devflow/artifacts/project-brief.json`.
- [ ] The project brief includes source documents, extracted signals, user stories, requirement constraints, stack profile, acceptance criteria, delivery risks, open questions, and verification commands.
- [ ] The project brief includes UI design assets referenced by Markdown image links, local file existence, lightweight SVG metadata including color swatches, and PNG/JPEG dimensions when available.
- [ ] The project brief includes API endpoint contracts extracted from HTTP method/path references.
- [ ] The project brief includes API data model summaries extracted from fenced `json` examples.
- [ ] The project brief includes API error cases and authentication requirements extracted from API docs.
- [ ] The project brief includes API contracts, API data models, API error cases, and API auth requirements extracted from fenced OpenAPI JSON/YAML blocks.
- [ ] `dev-flow plan` reads configured documents and writes `.devflow/artifacts/implementation-plan.md`.
- [ ] `dev-flow plan` also writes `.devflow/artifacts/project-brief.json`.
- [ ] Implementation plans include a `Frontend Delivery Blueprint` with routes/navigation, components, state/interaction, data/API integration, styling/responsive rules, test plan, and accessibility sections.
- [ ] Provider-generated implementation plans do not write patch-set JSON into `.devflow/artifacts/implementation-plan.md`; invalid plan-slot patch-set responses fall back to the local planner.
- [ ] `dev-flow tasks` writes `.devflow/artifacts/tasks.json` and `.devflow/artifacts/tasks.md`.
- [ ] Task plans include implementation units derived from user stories, requirement constraints, requirements, UI signals, design assets, API endpoints, API data models, API error cases, and API auth requirements.
- [ ] `dev-flow execute --dry-run` writes patch proposals without changing source files.
- [ ] Dry-run patch proposals include a stack-specific target profile with candidate component, data, style, test, config, and verification targets.
- [ ] AI dry-run and AI patch-set prompts include bounded repository source context sampled from target profile candidates.
- [ ] AI dry-run and AI patch-set prompts can omit sampled repository source snippets with `--no-source-context` or `DEVFLOW_SOURCE_CONTEXT=none`.
- [ ] `dev-flow execute --dry-run --unit <id>` scopes patch proposals to one implementation unit.
- [ ] `dev-flow execute --dry-run` uses the AI provider for patch proposals when a provider key or fixture is configured.
- [ ] `dev-flow execute --validate --patch-set <path>` validates patch sets without changing source files.
- [ ] The package includes `schemas/patch-set.schema.json` for external AI agents, editors, and CI checks.
- [ ] `dev-flow execute --apply --patch-set <path>` validates and applies patch set write, replace, and delete operations.
- [ ] Patch-set validation rejects oversized operation counts, write payloads, search strings, and replacement payloads.
- [ ] Applied patch sets are recorded in `.devflow/artifacts/execution-log.json`.
- [ ] Failed patch-set application restores the apply backup automatically and writes `.devflow/artifacts/rollback-report.json`.
- [ ] `dev-flow execute --rollback --backup <manifest>` restores files and writes `.devflow/artifacts/rollback-report.json`.
- [ ] `dev-flow verify` writes `.devflow/artifacts/verification-report.json`.
- [ ] `dev-flow visual --url <preview-url>` writes screenshots, blank-screen analysis, layout issue checks, and `.devflow/artifacts/visual/visual-report.json`.
- [ ] `dev-flow report` writes `.devflow/artifacts/delivery-report.md` with source context, user stories, requirement constraints, acceptance criteria, stack, API contracts, API data models, API error cases, API auth requirements, applied changes, touched files, operation counts, line-count deltas, verification, visual checks, delivery readiness, and next actions.
- [ ] `dev-flow report` writes `.devflow/artifacts/delivery-manifest.json` with machine-readable artifact statuses, readiness, verification, visual, source-change, acceptance-evidence, touched-file, backup, screenshot, open-question, and delivery-risk summaries.
- [ ] The published package includes `schemas/delivery-manifest.schema.json` so external tools can validate delivery manifests.
- [ ] `dev-flow status` reads a delivery manifest and prints readiness, verification, visual, source-change, artifact, risk, and open-question summaries.
- [ ] `dev-flow status --json` prints the raw delivery manifest JSON.
- [ ] `dev-flow status --fail-on-attention` exits non-zero when delivery readiness is not `ready for review`.
- [ ] `dev-flow status --fail-on-failed-verification` exits non-zero when manifest verification status is `failed`.
- [ ] Delivery reports do not reuse older visual verification artifacts when the current `dev-flow deliver` run does not include `--preview-url`.
- [ ] `dev-flow deliver` runs plan, tasks, dry-run execution, verification, optional visual checks, and report generation.
- [ ] `dev-flow deliver --unit <id>` scopes the delivery dry-run proposal to one implementation unit.
- [ ] `dev-flow deliver --apply --yes` runs plan, tasks, dry-run execution, source-changing apply, verification, optional visual checks, and report generation.
- [ ] `dev-flow deliver --apply --yes --unit <id>` runs source-changing delivery for one implementation unit when an AI provider or fixture is configured.
- [ ] `dev-flow plan` uses an OpenAI-compatible provider when a provider key or fixture is configured.
- [ ] The GitHub Action writes a job summary from `.devflow/artifacts/delivery-manifest.json` by default and can disable it with `job-summary: "false"`.
- [ ] `dev-flow plan` uses a deterministic local fallback when no AI key is configured.
- [ ] `dev-flow doctor` reports runtime, document, config, Playwright Chromium, and AI provider readiness.
- [ ] `dev-flow doctor --json` reports whether sampled repository source snippets are enabled for AI prompts.
- [ ] The repository includes a composite GitHub Action that runs safe `dev-flow deliver` by default and requires explicit confirmation for source-changing delivery.
- [ ] The repository includes product, architecture, roadmap, contribution, license, and quick-start docs.
- [ ] The project can be built and tested with `npm run check`.

## Constraints

- The MVP must not require a cloud service.
- Generated plans must remain human-readable Markdown.
- The CLI should detect stack signals without requiring framework-specific plugins in the MVP.
- Provider-specific logic must stay isolated from planning workflow code.
