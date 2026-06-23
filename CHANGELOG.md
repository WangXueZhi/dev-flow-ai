# Changelog

All notable changes to DevFlow will be documented in this file.

## 0.1.0 - MVP Preview

- Added a local-first `dev-flow` CLI for frontend delivery workflows.
- Added `dev-flow version` and `dev-flow --version` for installed CLI diagnostics.
- Added the installed CLI version to `dev-flow doctor` output.
- Added `dev-flow doctor --json` for machine-readable diagnostics.
- Updated the bug report template to collect sanitized `dev-flow doctor --json` diagnostics.
- Added optional artifact uploads to the composite GitHub Action.
- Updated the composite GitHub Action to support GitHub package specs before the first npm release.
- Added a root `npm run example:smoke` command for a disposable fixture-backed delivery trial.
- Added a `npm run github:smoke` command to verify the pre-release GitHub install path.
- Added `--no-source-context`, `DEVFLOW_SOURCE_CONTEXT=none`, and a GitHub Action `source-context` input to omit sampled repository source snippets from AI prompts.
- Added source-context diagnostics to `dev-flow doctor` and `dev-flow doctor --json`.
- Added `dev-flow execute --validate --patch-set <path>` for non-mutating patch-set validation.
- Added patch-set validation to the fixture-backed example smoke flow.
- Added `schemas/patch-set.schema.json` and patch-set schema documentation.
- Clarified `dev-flow init` output and covered preservation of existing handoff documents.
- Added per-acceptance-criterion evidence summaries to generated delivery reports.
- Added project initialization for `.devflow` config, artifacts, and structured starter source documents.
- Added requirements, UI notes, and API docs ingestion.
- Added lightweight local design asset metadata extraction for SVG width, height, viewBox, title, description, color swatches, and text snippets, plus PNG/JPEG dimensions.
- Added API error case and auth requirement extraction for planning, task units, and delivery reports.
- Added fenced OpenAPI JSON/YAML extraction for paths, component schemas, request/response schemas, error responses, and security requirements.
- Added repository stack detection for package manager, runtime, framework, build, styling, testing, scripts, source directories, and config files.
- Added structured project brief generation.
- Added structured user story and requirement constraint extraction from requirements documents.
- Added deterministic fallback planning and OpenAI-compatible provider support.
- Added an optional live provider smoke test script for release validation without making paid AI credentials mandatory for contributors.
- Added task plan generation.
- Added dry-run patch proposals with stack-specific target profiles for likely component, data, style, test, config, and verification targets.
- Added bounded repository source-context sampling for AI dry-run and patch-set prompts.
- Added validated patch-set application with operation and payload limits, execution logs, backups, rollback, and automatic backup restoration when apply fails after partial writes.
- Added guarded patch-set delete operations with backup and rollback coverage for obsolete source files.
- Added safe `deliver` orchestration with optional explicitly approved source-changing apply.
- Added verification reports, visual screenshot checks, and delivery reports with applied-change summaries, touched files, operation counts, backup counts, and line-count deltas.
- Added visual blank-screen detection with pixel-level screenshot analysis in visual reports.
- Added basic visual layout-overflow detection for horizontal overflow and clipped text.
- Added acceptance criteria and delivery readiness summaries to delivery reports.
- Added a report option and delivery behavior to avoid reusing stale visual verification artifacts when no preview URL is provided.
- Added a composite GitHub Action for safe CI delivery runs.
- Added CI coverage for fixture-backed source-changing delivery on the React/Vite example.
- Added a trackable React/Vite example fixture for replaying source-changing delivery while keeping generated `.devflow` artifacts ignored.
- Added a GitHub Release workflow for npm publishing with provenance.
- Added public npm publish configuration for the CLI package.
- Added GitHub install support through the package `prepare` lifecycle so developers can install the CLI before the first npm release.
- Added an adoption guide for running DevFlow inside existing frontend repositories.
- Included project docs and the React/Vite example source in the published package so README links remain useful after install without shipping generated artifacts.
- Added an automated package contents check to prevent generated artifacts, dependencies, and test outputs from entering npm tarballs.
- Added an explicit Release workflow check for the `NPM_TOKEN` secret before npm publishing.
- Added draft release notes for `v0.1.0`.
- Added open-source governance files and GitHub issue and pull request templates.
- Added a React/Vite dashboard example and CI coverage for the core workflow.
