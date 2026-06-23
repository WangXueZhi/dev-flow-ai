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
- Risk scoring for ambiguous requirements.
- Task plan generation.
- Dry-run patch proposal generation.
- Dry-run proposal UI checklist and delivery risk surfacing.
- Initial stack-specific target profiles for dry-run and patch-set prompts.
- Bounded repository source-context sampling for AI dry-run and patch-set prompts.
- Validated patch-set application.
- Verification report.
- Visual screenshot report with basic blank-screen and layout-overflow detection.
- Inferred delivery visual text checks from design asset snippets and UI state labels.
- Delivery report.
- Delivery report change summaries with touched files, operation counts, backup counts, and line-count deltas.
- Per-acceptance-criterion delivery evidence with known gaps, assumptions, and manual QA prompts.
- Embedded screenshots in delivery reports when visual artifacts are available.
- Machine-readable delivery manifest for artifact status, readiness, verification, visual, source-change, screenshot, touched-file, backup, open-question, and delivery-risk summaries.
- Safe deliver orchestration command with explicit source-changing apply.
- Composite GitHub Action for safe CI delivery runs.
- React/Vite dashboard example.

## Milestone 1: Better Planning

- Deeper stack detection for React, Vue, Next.js, Vite, Nuxt, Svelte, Angular, and Astro conventions.
- Better structured project brief and task output with normalized routes, components, data needs, and UI states.
- Richer API contract extraction for deeper schema semantics beyond endpoint, JSON model, OpenAPI JSON/YAML, error, and auth summaries.
- Plan sections for routes, components, state, data fetching, styling, tests, and accessibility.
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
