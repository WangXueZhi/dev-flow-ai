# Patch Set Schema

DevFlow source-changing execution uses reviewed patch sets instead of free-form shell commands. A patch set is strict JSON with a task id, summary, and a bounded list of operations.

The machine-readable schema is available at:

```text
schemas/patch-set.schema.json
```

Use it when configuring AI agents, editor validation, CI checks, or reviewed fixture files. DevFlow still performs its own runtime validation before any apply.

## Validate Before Apply

Check a patch set without changing source files:

```bash
dev-flow execute --validate --patch-set .devflow/artifacts/patch-sets/reviewed.json
```

Then apply only after review:

```bash
dev-flow execute --apply --patch-set .devflow/artifacts/patch-sets/reviewed.json
```

## Operation Types

Patch sets support three operation types:

- `write`: write a full file. Set `overwrite: false` when an existing file must not be replaced.
- `replace`: replace exact text in an existing file. Set `expectedReplacements` when the replacement count must be exact.
- `delete`: delete a file. Set `missingOk: false` when the file must already exist.

## Runtime Limits

The schema mirrors DevFlow's runtime limits:

- At most 50 operations.
- Write content up to 500,000 characters.
- Replace search text up to 100,000 characters.
- Replace content up to 500,000 characters.
- Paths must be safe relative paths and cannot target `.git` or `node_modules`.

Runtime validation also measures byte size and checks existing file contents for `replace` and guarded `delete` operations.
