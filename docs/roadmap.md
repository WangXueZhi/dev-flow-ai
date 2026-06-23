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
- Task plan generation.
- Dry-run patch proposal generation.
- Initial stack-specific target profiles for dry-run and patch-set prompts.
- Bounded repository source-context sampling for AI dry-run and patch-set prompts.
- Validated patch-set application.
- Verification report.
- Visual screenshot report with basic blank-screen and layout-overflow detection.
- Delivery report.
- Delivery report change summaries with touched files, operation counts, backup counts, and line-count deltas.
- Safe deliver orchestration command with explicit source-changing apply.
- Composite GitHub Action for safe CI delivery runs.
- React/Vite dashboard example.

## Milestone 1: Better Planning

- Deeper stack detection for React, Vue, Next.js, Vite, Nuxt, Svelte, Angular, and Astro conventions.
- Better structured project brief and task output with normalized routes, components, data needs, and UI states.
- Richer API contract extraction for deeper schema semantics beyond endpoint, JSON model, OpenAPI JSON/YAML, error, and auth summaries.
- Plan sections for routes, components, state, data fetching, styling, tests, and accessibility.
- Risk scoring for ambiguous requirements.
- Prompt fixtures and golden output tests.

## Milestone 2: Assisted Implementation

- Improve task files generated from the implementation plan.
- Expand dry-run patch proposals with deeper stack-specific file targeting and richer source-context selection beyond the initial bounded sampler.
- Improve source-changing execution with interactive approvals and richer change logs.
- Produce a change log for each task.
- Integrate with existing lint, typecheck, and test scripts.
- Feed verification results into the delivery report after code changes.

## Milestone 3: UI And Visual Verification

- Expand screenshot capture for local preview URLs beyond the default desktop/tablet set.
- Deeper responsive viewport checks.
- Basic overlap detection and richer screenshot heuristics beyond overflow checks.
- UI state checklist generation from design notes.
- Multimodal interpretation of referenced UI screenshots, wireframes, and design exports beyond lightweight image metadata.

## Milestone 4: Delivery Report

- Enrich changed-file summaries with reviewer notes and deeper diff stats beyond line-count deltas.
- Include richer verification results.
- Include screenshots when available.
- Expand delivery readiness into per-acceptance-criterion evidence, known gaps, assumptions, and manual QA items.

## Milestone 5: Ecosystem

- Workflow plugins for common frontend stacks.
- Provider plugins.
- Design-system adapters.
- Additional ecosystem integrations around the publishable GitHub Action.
- More example repositories.
