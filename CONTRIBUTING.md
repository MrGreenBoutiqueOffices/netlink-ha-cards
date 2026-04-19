# Contributing

## Local development

```bash
npm install
npm run typecheck
npm run lint
npm run format
npm run build
```

## Repository conventions

- Keep the public card types stable:
  - `custom:netlink-access-code-card`
  - `custom:netlink-status-card`
- Keep `package.json` on development version `0.0.0` in git; release versions are injected only during the release workflow.
- Prefer additive config changes over breaking renames.
- Keep Home Assistant dashboard behavior backward compatible unless a breaking change is explicitly intended.
- Update `README.md` when user-facing configuration changes.
- Update `CHANGELOG.md` with user-visible changes.

## Pull requests

- Keep changes scoped.
- Include screenshots or YAML examples when card behavior changes.
- Note any Home Assistant version assumptions in the PR description.
- Each PR publishes a preview artifact in GitHub Actions so the bundled card can be tested before merge.
- Add one release label to each PR so Release Drafter can classify and version changes correctly.
