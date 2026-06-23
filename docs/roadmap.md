# Roadmap

## Milestone 0: Repository Foundation

- CLI scaffold.
- Project docs.
- Local config.
- Deterministic planner.
- OpenAI-compatible provider.
- Runtime doctor command.
- Structured project brief.
- API error case and auth requirement extraction.
- OpenAPI JSON/YAML path, component schema, request/response schema, error response, and security extraction.
- Lightweight local SVG metadata/color extraction and PNG/JPEG dimension extraction for design assets.
- Basic repository stack detection.
- UI state checklist generation from design notes.
- Normalized frontend targets for routes/views, components, data needs, and UI states.
- Explicit frontend route path and component name extraction from requirements, UI notes, user stories, and acceptance criteria.
- Acceptance-criterion-derived frontend targets.
- Risk scoring for ambiguous requirements.
- Expanded stack detection from package manager metadata, nested source directories, and common frontend framework/tool config files.
- Task plan generation.
- Dry-run patch proposal generation.
- Dry-run proposal UI checklist and delivery risk surfacing.
- Initial stack-specific target profiles for dry-run and patch-set prompts.
- Explicit route/component-derived file candidates in target profiles and source-context sampling.
- Explicit API endpoint-derived data/API file candidates in target profiles and source-context sampling.
- Nuxt-aware route, layout, composable, server API, Playwright, and Cypress target profile candidates.
- Svelte/SvelteKit, Astro, and Angular-aware route, data/API, service, style, and spec target profile candidates.
- Normalized frontend target summaries in AI execution target profiles.
- Bounded repository source-context sampling for AI dry-run and patch-set prompts.
- Validated patch-set application.
- Human-readable task changelog generated after source-changing apply.
- Aggregated recommended verification commands from detected package scripts.
- Recommended verification command selection from common script aliases and dependency-aware TypeScript, test, and build tool fallbacks.
- Verification report with bounded failure excerpts.
- Default desktop, tablet, and mobile screenshot capture for local preview URLs.
- Visual screenshot report with basic blank-screen, layout-overflow, clipped-text, and visible-element overlap detection.
- Inferred delivery visual text checks from design asset snippets and UI state labels.
- Delivery report.
- Delivery report change summaries with touched files, operation counts, backup counts, and line-count deltas.
- Per-acceptance-criterion delivery evidence with known gaps, assumptions, and manual QA prompts.
- Embedded screenshots in delivery reports when visual artifacts are available.
- Local delivery status summary command backed by the delivery manifest.
- CI gate exits for delivery readiness attention and failed verification.
- Machine-readable delivery manifest for artifact status, readiness, verification, visual, source-change, screenshot, touched-file, backup, open-question, and delivery-risk summaries.
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
- Enrich task changelogs with reviewer notes and verification links.
- Further expand verification command selection with stack-specific framework aliases and dependency-aware checks.
- Feed verification results into the delivery report after code changes.

## Milestone 3: UI And Visual Verification

- Expand screenshot capture for local preview URLs beyond the default desktop/tablet/mobile set.
- Deeper responsive viewport checks.
- Richer screenshot heuristics beyond basic overflow, clipped-text, and overlap checks.
- Multimodal interpretation of referenced UI screenshots, wireframes, and design exports beyond lightweight image metadata.

## Milestone 4: Delivery Report

- Enrich changed-file summaries with reviewer notes and deeper diff stats beyond line-count deltas.
- Include richer verification results.
- Expand delivery readiness with deeper criterion-specific evidence matching.

## Milestone 5: Ecosystem

- Workflow plugins for common frontend stacks.
- Provider plugins.
- Design-system adapters.
- Additional ecosystem integrations around the publishable GitHub Action.
- More example repositories.
