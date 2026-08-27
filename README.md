# Praxicraft Assess for Make

Official [Make](https://www.make.com) Custom App for the **[Praxicraft Assess](https://assess.praxicraft.com)** Public API.

Use it to invite candidates, check invite quota, enroll hiring pipelines, fetch results, and start scenarios from Assess events — without writing HTTP modules.

**Requires a Make account and an Assess API key (Starter+).** Product docs: [docs.praxicraft.com/make](https://docs.praxicraft.com/make)

Same Public API surface as the [Zapier app](https://github.com/praxicraft-platform/zapier-praxicraft-assess) and [n8n node](https://github.com/praxicraft-platform/n8n-nodes-praxicraft-assess).

If you do not see **Praxicraft Assess** in Make’s app search yet, email [support@praxicraft.com](mailto:support@praxicraft.com) and we will share an invite link or help you install the Custom App in your organisation.

## Table of Contents

- [Authentication](#authentication)
- [Quickstart](#quickstart)
- [What you can do](#what-you-can-do)
  - [Invite a candidate](#invite-a-candidate)
  - [Bulk invites](#bulk-invites)
  - [Check invite quota](#check-invite-quota)
  - [Build and activate an assessment](#build-and-activate-an-assessment)
  - [Enroll into a hiring pipeline](#enroll-into-a-hiring-pipeline)
  - [Notify Slack when someone passes](#notify-slack-when-someone-passes)
  - [Trigger on Assess events](#trigger-on-assess-events)
- [Errors](#errors)
- [Requirements & support](#requirements--support)
- [License](#license)

---

## Authentication

Create an organisation API key in Assess:

**Assess → Developer → API Keys** → create key → copy `ct_live_…` (shown once).

In Make, add the **Praxicraft Assess** connection:

1. Paste the API key.
2. Leave **Base URL** as `https://assess.praxicraft.com` unless you use a custom host.
3. Save. Make tests the connection with `GET /api/v1/public/org/` (needs `organisation:read` or a full-access key).

Never commit API keys. Prefer a dedicated key for Make and rotate it if it leaks.

### Recommended scopes

| Use case | Scopes |
|----------|--------|
| Invite + notify on results | `assessments:read`, `invitations:write`, `candidates:read`, `webhooks:write` |
| Pipeline enroll | `pipelines:read`, `pipelines:write`, `webhooks:write` |

Scopes and rotation: [Authentication](https://docs.praxicraft.com/authentication)

---

## Quickstart

1. In Make, create a scenario and search for **Praxicraft Assess**.
2. Connect with your `ct_live_…` key (see [Authentication](#authentication)).
3. Add a module **Invite Candidate**:
   - Assessment (dropdown — or map a slug from a previous module)
   - Email (for example `candidate@example.com`)
   - Optional name
   - Set **Send Email** if Assess should mail the take link
4. Run once. The output includes `invite_token` and invite URL fields.
5. Turn the scenario **on**.

Invites are idempotent on email — safe to retry. Optional **External ID** stores your ATS candidate id so retries with the same id return the existing invite.

Responses are **flat JSON** (same shape as the Public API — no `{ "data": … }` wrapper).

---

## What you can do

Creates are writes. Searches are GET / list. All paths target `/api/v1/public/…` on the Assess host.

| Resource | Common modules |
|----------|----------------|
| Assessment | List / Get / Create / Update / Duplicate Assessment, List Assessment Results, Attach / Replace / Remove Tasks |
| Task | List Org Tasks, List Platform Tasks, Create / Get / Update / Delete Task |
| Invitation | List Invitations, Invite Candidate, Bulk Invite Candidates, Get Invitation, Get Invitation Result, Remind Candidate, Cancel Invitation |
| Pipeline | List Pipelines, Enroll Candidate, Bulk Enroll Candidates, List Enrollments, Reject / Hold / Unhold Enrollment |
| Webhook | List Webhooks, Create / Update / Delete Webhook, List Webhook Deliveries, Test Webhook |
| Organisation | Get Organisation, Get Organisation Stats, List Team Members, List Squads, List Audit Log |
| Interview | List Interviews, Create / Bulk Create Interview, Cancel / Reschedule, Get Analysis / Replay, Share Interview, templates |
| Integration | List Integrations, Get Integration Connect URL, Test Integration |
| Trigger | **Watch Assess Event** — one event per scenario |
| Advanced | **Make an API Call** — any Public API path |

Many modules use dropdowns for assessments, tasks, invitations, pipelines, enrollments, webhooks, interviews, templates, and squads. You can still map an id from a previous module. Bulk invite and enroll accept a JSON list of candidates (or comma-separated lists where noted).

### Invite a candidate

1. Module **Invite Candidate**
2. Assessment slug, email, optional name
3. Set **Send Email** if Assess should mail the take link
4. Optional **External ID** (ATS candidate id)

The module returns `invite_token` and invite URL fields.

### Bulk invites

1. Module **Bulk Invite Candidates**
2. Assessment slug
3. **Candidates JSON**, for example:

```json
[
  {"email": "a@example.com", "name": "Alex"},
  {"email": "b@example.com", "name": "Blair"}
]
```

4. Set **Send Email** if Assess should mail take links

### Check invite quota

1. Module **Get Organisation**
2. Use `invites_remaining` in a Filter or Router before a bulk invite

### Build and activate an assessment

1. Module **Create Assessment** (title, time limit, passing score)
2. Module **Attach Tasks** with task UUIDs (JSON array or comma-separated)
3. Module **Update Assessment** → Status `active`

### Enroll into a hiring pipeline

1. Module **Enroll Candidate**
2. Pipeline slug (for example `grad-2025`), email, optional name
3. Set **Send Email** if Assess should mail the pipeline invite

Follow with a get/list enrollment module using the returned enrollment id.

### Notify Slack when someone passes

1. Trigger **Watch Assess Event** → `candidate.passed`
2. Module: Slack **Create a Message** (or equivalent) with score and `invite_token`

There is no native Slack module inside this app. Use Make’s Slack app as the destination.

### Trigger on Assess events

**Watch Assess Event** starts a scenario when Assess delivers a webhook.

1. Choose one event (for example `candidate.passed` or `assessment.completed`).
2. Turn the scenario **on**. Make registers its hook URL with Assess and sends a test ping so the endpoint becomes verified/active.
3. Turning the scenario **off** deletes that webhook destination.

Assess signs every payload (`X-Praxicraft-Signature`). Make owns the hook URL, so you do not need to verify HMAC inside the scenario (same model as Zapier). `webhook.test` pings are acknowledged but do not start the scenario.

High-value events: `assessment.completed`, `candidate.passed` / `failed`, `pipeline.advanced` / `completed` / `rejected`, `interview.completed` / `analysis_ready`.

Event catalog and payload examples: [Webhooks](https://docs.praxicraft.com/webhooks)

---

## Errors

Public API errors look like:

```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "This API key does not have the 'candidates:read' scope."
  }
}
```

Make fails the module. Branch on the error **code**, not the message text.

| Symptom | Fix |
|---------|-----|
| Connection test fails | Add `organisation:read` or use full-access scopes |
| Trigger never fires | The scenario must be **on**; the webhook must verify |
| `403 INSUFFICIENT_SCOPE` | Widen key scopes — [Scopes](https://docs.praxicraft.com/scopes) |
| `INVITE_QUOTA_EXCEEDED` | Check **Get Organisation** → `invites_remaining` |
| App missing in Make search | Email [support@praxicraft.com](mailto:support@praxicraft.com) for access |

Error codes: [Errors](https://docs.praxicraft.com/errors)

---

## Requirements & support

- A [Make](https://www.make.com) account
- An Assess API key (Starter+) from [Developer → API Keys](https://assess.praxicraft.com/assess/api)
- Product docs: [docs.praxicraft.com](https://docs.praxicraft.com)
- Make setup: [docs.praxicraft.com/make](https://docs.praxicraft.com/make)
- Automations overview: [docs.praxicraft.com/automations](https://docs.praxicraft.com/automations)
- Email: [support@praxicraft.com](mailto:support@praxicraft.com)
- Issues: [GitHub Issues](https://github.com/praxicraft-platform/make-praxicraft-assess/issues)

Developer notes (generate modules, deploy): see [RELEASING.md](./RELEASING.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
