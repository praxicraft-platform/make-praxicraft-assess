# Praxicraft Assess for Make

Official [Make](https://www.make.com) Custom App for the **[Praxicraft Assess](https://assess.praxicraft.com)** Public API.

Invite candidates, enroll pipelines, fetch results, and start scenarios from Assess webhook events — without hand-rolled HTTP modules.

**Requires a Make account and an Assess API key (Starter+).** Product docs: [docs.praxicraft.com/make](https://docs.praxicraft.com/make)

Source of truth: [github.com/praxicraft-platform/make-praxicraft-assess](https://github.com/praxicraft-platform/make-praxicraft-assess)

Same Public API surface as the [Zapier app](https://github.com/praxicraft-platform/zapier-praxicraft-assess) and [n8n node](https://github.com/praxicraft-platform/n8n-nodes-praxicraft-assess).

## Authentication

1. Create an organisation API key in **Assess → Developer → API Keys** (`ct_live_…` / `ct_test_…`).
2. In Make, add the **Praxicraft Assess** connection:
   - Paste the API key
   - Leave **Base URL** as `https://assess.praxicraft.com` unless you use a custom host
3. Make tests the connection with `GET /api/v1/public/org/`.

### Recommended scopes

| Use case | Scopes |
|----------|--------|
| Invite + notify on results | `assessments:read`, `invitations:write`, `candidates:read`, `webhooks:write` |
| Pipeline enroll | `pipelines:read`, `pipelines:write`, `webhooks:write` |

## Quickstart

1. In Make, create a scenario and add **Praxicraft Assess → Invite Candidate**.
2. Connect with your API key.
3. Set assessment slug, email, optional name / send email.
4. Optionally add **Watch Assess Event** (instant) for `candidate.passed` and route to Slack.

## Modules

| Group | Examples |
|-------|----------|
| Triggers | Watch Assess Event (instant webhook) |
| Invitations | Invite Candidate, Bulk Invite, Get Result, Remind, Cancel |
| Assessments | List / Get / Create / Update / Attach Cases |
| Pipelines | Enroll, Bulk Enroll, Hold / Reject |
| Interviews | Create Interview, Analysis, Share |
| Organisation | Get Organisation, Stats, Squads |
| Advanced | Make an API Call |

Events match Zapier/n8n: `assessment.*`, `candidate.*`, `invitation.expired`, `pipeline.*`, `interview.*`.

**Webhook note:** Activate registers the hook and runs Assess `POST /webhooks/{id}/test/` so the endpoint becomes verified/active. `webhook.test` pings are acknowledged but do not start the scenario. Signature verification relies on Make’s private webhook URL (same model as Zapier); n8n additionally verifies `X-Praxicraft-Signature` locally.

## Develop

```bash
npm test
npm run generate   # rebuild modules from scripts/catalog.js
```

Local edit with the [Make Apps Editor](https://marketplace.visualstudio.com/items?itemName=Integromat.apps-sdk) (clone / deploy against your Make org). Keep `scripts/operations.contract.js` in sync with Zapier/n8n.

## Release / deploy

Pushes to `main` that change app source run **Publish**:

1. Patch-bump + tag + GitHub Release
2. `node scripts/deploy-to-make.js` via `@makehq/cli` when secrets are set

See [RELEASING.md](./RELEASING.md).

## License

MIT
