# UI Notes

The MVP user interface is a terminal CLI. Output should be concise, predictable, and useful in local development, CI logs, and documentation.

UI notes may reference local screenshots, wireframes, or design exports with Markdown image links. DevFlow records those assets in the project brief, reports whether local files exist, reads lightweight metadata and color swatches from local SVG assets, and records PNG/JPEG dimensions when available.

## Commands

- `dev-flow init`: creates local project context and prints created locations.
- `dev-flow brief`: writes a structured project brief and prints detected stack summary.
- `dev-flow plan`: writes an implementation plan and reports the planner mode.
- `dev-flow tasks`: writes task plan JSON and Markdown.
- `dev-flow execute --dry-run`: writes patch proposal documents and prints proposal count.
- `dev-flow execute --dry-run --unit <id>`: scopes a patch proposal to one implementation unit.
- `dev-flow execute --validate`: validates a patch set without changing source files.
- `dev-flow execute --apply`: applies a validated patch set, records optional review notes, and prints execution log and task changelog paths.
- `dev-flow execute --rollback`: restores files from a backup manifest and prints rollback report path.
- `dev-flow verify`: writes a verification report, refreshes the existing task changelog verification summary, and prints status.
- `dev-flow visual`: captures desktop, tablet, and mobile screenshots, checks for blank screenshots and layout overflow, and prints visual status.
- `dev-flow report`: writes a delivery report.
- `dev-flow report --visual-report none`: writes a delivery report without reusing an existing visual report artifact.
- `dev-flow deliver`: runs the safe end-to-end delivery flow and prints each stage.
- `dev-flow deliver --unit <id>`: scopes the delivery dry-run proposal to one implementation unit.
- `dev-flow deliver --apply --yes`: runs dry-run proposals first, then approved source-changing execution before verification.
- `dev-flow deliver --apply --yes --unit <id>`: runs approved source-changing execution for one implementation unit.
- `dev-flow doctor`: prints installed version and readiness checks with simple status prefixes.
- `dev-flow doctor --json`: prints the same diagnostics as structured JSON for CI and issue reports.
- `dev-flow --help`: shows command usage, flags, and AI environment variables.
- `dev-flow --version`: prints the installed CLI version.

## Output Style

- Use plain text that works in any terminal.
- Keep success messages short.
- Include generated artifact paths.
- Avoid noisy progress output in the MVP.
- Make missing AI configuration non-fatal.

## States

- Success: print the primary artifact or config path.
- Dry-run proposal content: include stack targeting so reviewers can see likely component, data, style, test, config, and verification targets before source files change.
- Missing docs: explain which file could not be read and suggest `dev-flow init` or explicit flags.
- Missing AI key: use fallback planner and explain that AI is optional.
- Missing Chromium: explain that visual checks require Playwright Chromium and print `npx playwright install chromium`.
- Blank preview screenshot: mark visual verification failed and include the screenshot analysis in the visual report.
- Layout issues: mark visual verification failed and include horizontal overflow, clipped-text, or overlap details in the visual report.
- Missing patch set: explain that `execute --apply` requires `DEVFLOW_AI_API_KEY`, `OPENAI_API_KEY`, `DEVFLOW_AI_FIXTURE_PATH`, or `--patch-set`.
- Oversized patch set: explain which operation count or payload limit was exceeded.
- Dirty worktree guard: when `--require-clean` is used, stop before source-changing apply and explain which local git changes must be committed, stashed, or discarded.
- Failed apply: restore the apply backup, write a rollback report, and explain the original apply failure.
- Missing delivery confirmation: explain that `deliver --apply` changes project files and requires `--yes`.
- Missing delivery apply source: explain that `deliver --apply` requires `--task <id>`, `--unit <id>`, or `--patch-set <path>`.
- Unsafe patch path: explain why the patch operation was rejected.
- Provider failure: surface status code and response body.
- No preview URL in delivery: report that visual verification has not run for this delivery instead of reusing older visual evidence.
- Unknown command: print a clear error and non-zero exit code.

## Future Web UI

- Project overview dashboard.
- Document coverage view.
- Plan review and approval flow.
- Task execution log and task changelog.
- Verification and delivery report view.
