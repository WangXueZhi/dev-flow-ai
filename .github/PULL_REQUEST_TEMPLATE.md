## Summary

- 

## Change Type

- [ ] CLI behavior
- [ ] Context extraction or planning
- [ ] Execution, patch sets, or rollback
- [ ] Verification, visual checks, or reports
- [ ] GitHub Action or packaging
- [ ] Documentation or examples

## Safety Notes

- [ ] This does not make paid AI credentials mandatory for normal tests.
- [ ] Source-changing execution still requires explicit approval or a reviewed patch set.
- [ ] Provider keys, secrets, and private model responses are not logged.
- [ ] Generated artifacts remain human-readable.

## Verification

Paste the commands you ran:

```bash
npm run check
npm run pack:dry-run
npm run pack:smoke
```

For delivery, provider, or visual changes, include the relevant example command and artifact paths.
