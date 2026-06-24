# Product Vision

DevFlow helps frontend teams move from project context to delivered code with an AI workflow that is explicit, reviewable, and grounded in local repository conventions.

## Target Users

- Solo frontend developers who want AI to understand requirements before coding.
- Product engineers who receive PRDs, UI designs, and API contracts from different sources.
- Small teams that want repeatable AI-assisted delivery without building internal tooling first.
- Open-source maintainers who want contributors to follow a consistent implementation workflow.

## Core Promise

Developers should be able to run DevFlow inside a frontend repository, provide three kinds of context, and receive a practical implementation plan:

- Requirements: goals, scope, user stories, acceptance criteria, constraints.
- UI: screens, components, states, interactions, responsive behavior, design tokens.
- API: endpoints, parameters, schemas, auth, errors, loading states, integration notes.

The workflow should continue from plan to scoped implementation work, verification, visual evidence, and a delivery report.

## Principles

- Context before code.
- Small changes before sweeping rewrites.
- Human-readable plans and diffs.
- Local-first by default.
- Provider-neutral AI integration.
- Verification is part of the product, not an afterthought.

## Non-Goals For The First MVP

- Full autonomous application generation.
- Pixel-perfect UI generation from binary design files.
- Replacing product, design, QA, or code review.
- Supporting every frontend stack on day one.

## First Useful Outcome

The first release should make this command useful:

```bash
dev-flow deliver
```

It should produce a reviewable delivery trail that a frontend developer can inspect, verify, and hand to an AI coding agent before source-changing execution.
