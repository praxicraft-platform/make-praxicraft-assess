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
| `MAKE_ZONE` | for deploy | Zone host, e.g. `eu2.make.com` or `us1.make.com` |
| `MAKE_APP_NAME` | for deploy | Remote SDK app name (must already exist) |
| `MAKE_APP_VERSION` | optional | Remote app version (default `1`) |

If secrets are missing, publish still cuts the GitHub Release and prints a skip warning (same pattern as Zapier without `ZAPIER_*`).

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
