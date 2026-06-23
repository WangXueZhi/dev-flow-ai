# Contributing

Thanks for helping shape DevFlow.

Start with the full contributor guide in [docs/contributing.md](docs/contributing.md). The short version:

- Keep changes small and reviewable.
- Preserve the local-first workflow and deterministic fallback path.
- Do not require paid AI credentials for normal tests.
- Run `npm run check` before opening a pull request.
- For release-oriented changes, also run `npm run pack:dry-run` and `npm run pack:smoke`.

Useful local commands:

```bash
npm install
npm run check
npm run pack:dry-run
npm run pack:smoke
```

`npm run smoke:live` is optional and skips unless `DEVFLOW_AI_API_KEY` or `OPENAI_API_KEY` is configured.
