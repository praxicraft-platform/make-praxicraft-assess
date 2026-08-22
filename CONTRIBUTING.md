# Contributing

1. Keep `scripts/operations.contract.js` identical to Zapier `lib/operations.contract.js` and n8n `operations.contract.ts`.
2. Add or change operations in `scripts/catalog.js`, then run `npm run generate`.
3. Run `npm test` before opening a PR.
4. Do not commit `.secrets/` or live API keys.

Local Make sync: use the VS Code Make Apps Editor against your org, or `npm run deploy` with `MAKE_*` env vars (see RELEASING.md).
