# Changelog

## 0.0.5

- Maintenance release.

## 0.0.4

- fix: preflight Make app name/version before deploy

## 0.0.3

- fix: align Make deploy script with @makehq/cli 1.4 flags

## 0.0.2

- docs: align README with Zapier-style product guide

## 0.0.1

- Maintenance release.

## 0.1.0

- Initial Make Custom App: Bearer API key connection, Public API parity (~64 modules), Watch Assess Event instant trigger, RPCs, Make an API Call.
- Hardening: `omit()` bodies (no empty optional fields), list coerce (JSON or comma-separated), search `results` + `next` pagination, webhook attach stores `id`/`secret_key` then `POST …/test/`, detach ignores 404, RPC selects on invite/pipeline slugs, resilient `deploy-to-make.js`.
- CI + publish workflow with optional Make deploy via `make-cli`.
