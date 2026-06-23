# Security Policy

DevFlow is an early-stage local-first CLI. Please report security issues privately before opening a public issue.

## Supported Versions

The current MVP preview is `0.1.x`. Until the project has stable releases, security fixes target the latest `main` branch and the next preview release.

## Reporting A Vulnerability

Email the maintainers or use a private security advisory in the project repository when available. Include:

- Affected version or commit.
- Reproduction steps.
- Impact and any known workaround.
- Whether credentials, generated patch sets, local files, or CI logs are involved.

Please do not include real API keys, private source code, or customer data in the report.

## Security Expectations

- DevFlow must not require secrets for normal local tests.
- Provider keys should be read from environment variables, not committed config files.
- Live provider prompts may include bounded source snippets; users should choose providers according to their code privacy requirements.
- Source-changing execution must remain explicit and reviewable.
- Patch-set paths must stay constrained to the target workspace.
- CI examples should avoid printing provider credentials or private model responses.
