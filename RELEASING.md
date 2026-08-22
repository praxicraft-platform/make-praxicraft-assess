# Releasing

## Automatic (preferred)

Pushes to `main` that change Custom App source trigger **Publish** (`.github/workflows/publish.yml`):

1. Run tests
2. Patch-bump `package.json` + prepend `CHANGELOG.md`
3. Commit `chore(release): vX.Y.Z`, tag, push
4. Deploy definitions to Make (`scripts/deploy-to-make.js`) when secrets exist
5. Attach a zip to the GitHub Release

Skipped when the head commit starts with `chore(release):` or contains `[skip release]`.

## GitHub secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `MAKE_API_KEY` | for deploy | Make Platform API key with Custom Apps access |
| `MAKE_ZONE` | for deploy | Zone host from the browser URL — e.g. `eu1.make.com` (not eu2/us1 unless that’s your URL) |
| `MAKE_APP_NAME` | for deploy | Exact Name from `sdk-apps list` (Make may append a suffix, e.g. `praxicraft-assess-5nwwt8`). Not the Label “Praxicraft Assess”. |
| `MAKE_APP_VERSION` | optional | Make Custom App version **integer** (default `1`). Not `package.json` / `v0.0.2` |
| `MAKE_APP_CREATE` | optional | Set to `1` in the job env to auto-create the app when missing |

If secrets are missing, publish still cuts the GitHub Release and prints a skip warning (same pattern as Zapier without `ZAPIER_*`).

### `Unknown app or version` / `Access denied or App not found`

Deploy talks to Make as `MAKE_APP_NAME`@`MAKE_APP_VERSION` in `MAKE_ZONE`. Your screenshot is on **`eu1.make.com`** — set `MAKE_ZONE=eu1.make.com`.

The UI shows the **Label** (“Praxicraft Assess”). The API **Name** is often suffixed (your list showed `…-5nwwt8`). Copy that Name into `MAKE_APP_NAME`.

```bash
export MAKE_API_KEY=...
export MAKE_ZONE=eu1.make.com
npx @makehq/cli@1.4.0 sdk-apps list
npx @makehq/cli@1.4.0 sdk-apps get --name='<name-from-list>' --version=1
```

Deploy also auto-resolves when the secret Name is a prefix of the listed Name, or when the Label is `Praxicraft Assess`.

## One-time Make app bootstrap

Create the empty Custom App once (UI or CLI), then point secrets at it:

```bash
export MAKE_API_KEY=...
export MAKE_ZONE=eu2.make.com

npx @makehq/cli sdk-apps create \
  --name=praxicraft-assess \
  --label='Praxicraft Assess' \
  --description='Assess Public API for Make' \
  --theme=#0D41FF \
  --language=en \
  --audience=global \
  --private
```

Then set `MAKE_APP_NAME=praxicraft-assess` and `MAKE_APP_VERSION=1` in GitHub Actions secrets.

Invite-link / App Review publishing is done in the Make UI after definitions sync.

## Manual deploy

```bash
export MAKE_API_KEY=...
export MAKE_ZONE=eu2.make.com
export MAKE_APP_NAME=praxicraft-assess
export MAKE_APP_VERSION=1
npm run deploy
```

`scripts/deploy-to-make.js` targets `@makehq/cli@1.4.0`:

- Connections / webhooks: no `--app-version`; remote names come from `list`/`create` (often `{app-name}` or `{app-name}-N`)
- Connection sections: `parameters` + `api` (not `params` / `communication`)
- Modules: require `--type-id` (`action=4`, `search=9`, `instant_trigger=10`, `universal=12`)
- Instant-trigger webhook link: REST `PATCH` (CLI update has no `--webhook`)
