# Roadmap

## Milestone 0: Repository Foundation

- CLI scaffold.
- Project docs.
- Local config.
- Deterministic planner.
- OpenAI-compatible provider.
- Runtime doctor command.
- Structured project brief.
- API error case, auth requirement, and API-driven state requirement extraction.
- API parameter extraction for inline endpoint references and OpenAPI parameter objects.
- OpenAPI/Swagger JSON/YAML path, parameter, component schema, request/response schema, error response, and security extraction from fenced blocks and local links.
- GraphQL operation and schema extraction from inline notes, fenced blocks, and local `.graphql` or `.gql` links.
- Lightweight local SVG metadata/color extraction, PNG/JPEG dimension extraction, and recognized design handoff link capture for design assets.
- UI design token extraction for colors, typography, spacing, radius, shadows, motion, and iconography.
- Basic repository stack detection.
- UI state checklist generation from design notes.
- Normalized frontend targets for routes/views, components, data needs, and UI states.
- Explicit frontend route path and component name extraction from requirements, UI notes, user stories, and acceptance criteria.
- Acceptance-criterion-derived frontend targets.
- Acceptance criteria extraction from checkbox items, acceptance sections, Gherkin lines, tables, and localized headings.
- Risk scoring for ambiguous requirements.
- Expanded stack detection from package manager metadata, workspace packages, nested source directories, and common frontend framework/tool config files.
- Task plan generation.
- Implementation unit dependency hints and type-specific review checklists in task artifacts and focused dry-run proposals.
- Dry-run patch proposal generation.
- Dry-run proposal UI checklist and delivery risk surfacing.
- Initial stack-specific target profiles for dry-run and patch-set prompts.
- Explicit route/component-derived file candidates in target profiles and source-context sampling, including React Router route configuration candidates for React/Vite projects.
- Explicit API endpoint-derived data/API file candidates in target profiles and source-context sampling.
- Nuxt-aware route, layout, composable, server API, Playwright, and Cypress target profile candidates.
- Svelte/SvelteKit, Astro, and Angular-aware route, data/API, service, style, and spec target profile candidates.
- Normalized frontend target summaries in AI execution target profiles.
- Bounded repository source-context sampling for AI dry-run and patch-set prompts.
- Explicit local prompt audit artifacts for planner, dry-run, patch-set, and delivery flows.
- Validated patch-set application.
- Optional clean-worktree guardrails for source-changing apply.
- Human-readable task changelog generated after source-changing apply.
- Task changelog review handoff notes with execution, verification, and delivery artifact links.
- Reviewer-authored task changelog notes from source-changing apply.
- Task changelog verification summary refreshes after `dev-flow verify` runs.
- Aggregated recommended verification commands from detected root and workspace package scripts.
- Recommended verification command selection from common local/CI script aliases, coverage/audit scripts, and dependency-aware quality, framework type-checking, test, and build tool fallbacks.
- Verification report with bounded failure excerpts.
- Verification remediation hints and structured remediation plans in delivery reports, manifests, local status output, and GitHub Actions job summaries.
- Machine-readable live provider smoke reports for release evidence.
- Installed CLI live-provider smoke command for demos, release gates, and provider diagnostics.
- Default desktop, tablet, and mobile screenshot capture for local preview URLs.
- Visual screenshot report with basic blank-screen, layout-overflow, clipped-text, and visible-element overlap detection.
- Machine-readable visual layout issue details in delivery manifests and status summaries.
- Missing required visual text summaries in local status and GitHub Actions job summaries.
- Inferred delivery visual text checks from design asset snippets, visible acceptance-criteria text, and UI state labels.
- Delivery report.
- Delivery report change summaries with touched files, operation counts, backup counts, and line-count deltas.
- Machine-readable applied operation details in delivery manifests and status summaries.
- Per-acceptance-criterion delivery evidence with known gaps, assumptions, and manual QA prompts.
- Criterion-specific delivery evidence matching from visual text, UI state, API state, API error, and API auth signals.
- Embedded screenshots in delivery reports when visual artifacts are available.
- Local delivery status summary command backed by the delivery manifest.
- CI gate exits for delivery readiness attention, failed verification, and failed visual checks.
- Machine-readable delivery manifest for artifact status, readiness, verification, visual, visual-text, visual-layout, source-change, API-state, screenshot, touched-file, applied-operation, backup, open-question, and delivery-risk summaries.
- Published delivery manifest JSON schema for CI, editor, dashboard, and downstream-agent integrations.
- Frontend delivery blueprint sections in implementation plans for routes, components, state, data fetching, styling, tests, and accessibility.
- Planner guardrails that prevent patch-set JSON from replacing implementation-plan artifacts and append missing frontend blueprint sections to provider plans.
- Safe deliver orchestration command with explicit source-changing apply.
- Composite GitHub Action for safe CI delivery runs, artifact uploads, manifest-backed job summaries, and manifest-backed delivery gates.
- React/Vite dashboard example.

## Milestone 1: Better Planning

- Further stack-specific routing, data-fetching, testing, and styling conventions for React, Vue, Next.js, Vite, Nuxt, Svelte, Angular, and Astro projects.
- Further route/component/data/state target extraction beyond the initial normalized frontend targets.
- Richer API contract extraction for deeper schema semantics beyond endpoint, JSON model, OpenAPI JSON/YAML, error, and auth summaries.
- Prompt fixtures and golden output tests.

## Milestone 2: Assisted Implementation

- Further improve task files generated from the implementation plan with richer dependency ordering and review metadata.
- Expand dry-run patch proposals with deeper stack-specific file targeting and richer source-context selection beyond the initial bounded sampler.
- Improve source-changing execution with interactive approvals and richer review metadata.
- Further enrich task changelogs with deeper review metadata.
- Further expand verification command selection with provider-aware smoke checks and richer CI artifact gates.

## Milestone 3: UI And Visual Verification

- Expand screenshot capture for local preview URLs beyond the default desktop/tablet/mobile set.
- Deeper responsive viewport checks.
- Richer screenshot heuristics beyond basic overflow, clipped-text, and overlap checks.
- Multimodal interpretation of referenced UI screenshots, wireframes, and design exports beyond lightweight link/image metadata.

## Milestone 4: Delivery Report

- Enrich changed-file summaries with reviewer notes and deeper diff stats beyond line-count deltas.
- Include richer verification results.
- Further expand delivery readiness with code, diff, and screenshot-specific evidence matching.

## Milestone 5: Ecosystem

- Workflow plugins for common frontend stacks.
- Provider plugins.
- Design-system adapters.
- Additional ecosystem integrations around the publishable GitHub Action.
- More example repositories.
