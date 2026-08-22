const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { PUBLIC_API_OPERATIONS } = require("../scripts/operations.contract");
const { CATALOG, camelModule, ASSESS_WEBHOOK_EVENTS } = require("../scripts/catalog");

const ROOT = path.join(__dirname, "..");

describe("parity", () => {
  it("catalog covers every contracted Public API operation", () => {
    const missing = [];
    for (const op of PUBLIC_API_OPERATIONS) {
      const found = CATALOG.find((c) => c.resource === op.resource && c.operation === op.operation);
      if (!found) missing.push(`${op.resource}.${op.operation}`);
    }
    assert.equal(missing.length, 0, `missing: ${missing.join(", ")}`);
    assert.ok(PUBLIC_API_OPERATIONS.length >= 60);
  });

  it("every catalog module has generated IML files", () => {
    for (const row of CATALOG) {
      const name = camelModule(row.resource, row.operation);
      const dir = path.join(ROOT, "modules", name);
      for (const suffix of ["communication", "mappable-params", "interface", "samples"]) {
        const file = path.join(dir, `${name}.${suffix}.iml.json`);
        assert.ok(fs.existsSync(file), `missing ${file}`);
      }
    }
  });

  it("makecomapp.json registers all catalog modules plus trigger and universal", () => {
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, "makecomapp.json"), "utf8"));
    const modules = Object.keys(app.components.module);
    for (const row of CATALOG) {
      const name = camelModule(row.resource, row.operation);
      assert.ok(modules.includes(name), `makecomapp missing ${name}`);
    }
    assert.ok(modules.includes("watchAssessEvent"));
    assert.ok(modules.includes("makeAnApiCall"));
    assert.equal(app.components.module.watchAssessEvent.moduleType, "instant_trigger");
    assert.equal(app.components.module.watchAssessEvent.webhook, "assessEvents");
  });

  it("webhook event list matches n8n/Zapier", () => {
    const values = ASSESS_WEBHOOK_EVENTS.map((e) => e.value);
    const required = [
      "assessment.started",
      "assessment.completed",
      "candidate.violation",
      "candidate.passed",
      "candidate.failed",
      "invitation.expired",
      "pipeline.advanced",
      "pipeline.completed",
      "pipeline.rejected",
      "interview.scheduled",
      "interview.started",
      "interview.completed",
      "interview.cancelled",
      "interview.analysis_ready",
    ];
    for (const v of required) {
      assert.ok(values.includes(v), `missing event ${v}`);
    }
  });

  it("connection validates against /org/", () => {
    const comm = JSON.parse(
      fs.readFileSync(path.join(ROOT, "connections/apiKey/apiKey.communication.iml.json"), "utf8"),
    );
    assert.match(comm.url, /\/api\/v1\/public\/org\//);
    assert.match(comm.headers.Authorization, /Bearer/);
  });

  it("invite candidate omits path slug from body via omit()", () => {
    const comm = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "modules/invitationInvite/invitationInvite.communication.iml.json"),
        "utf8",
      ),
    );
    assert.equal(comm.method, "POST");
    assert.match(comm.url, /invites/);
    assert.ok(comm.body["{{...}}"]);
    assert.match(String(comm.body["{{...}}"]), /omit\(parameters/);
    assert.match(String(comm.body["{{...}}"]), /slug/);
  });

  it("search modules iterate body.results and paginate via body.next", () => {
    const comm = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "modules/assessmentList/assessmentList.communication.iml.json"),
        "utf8",
      ),
    );
    assert.match(String(comm.response.iterate), /body\.results/);
    assert.ok(comm.pagination);
    assert.equal(comm.pagination.url, "{{body.next}}");
  });

  it("attach stores webhook id+secret and runs test ping", () => {
    const attach = JSON.parse(
      fs.readFileSync(path.join(ROOT, "webhooks/assessEvents/assessEvents.attach.iml.json"), "utf8"),
    );
    assert.ok(Array.isArray(attach), "attach should be a sequential request array");
    assert.match(attach[0].url, /webhooks\/create/);
    assert.equal(attach[0].response.data.id, "{{body.id}}");
    assert.equal(attach[0].response.data.secret_key, "{{body.secret_key}}");
    assert.match(attach[1].url, /test/);
  });

  it("attachCases coerces comma-separated or JSON case_ids", () => {
    const comm = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "modules/assessmentAttachCases/assessmentAttachCases.communication.iml.json"),
        "utf8",
      ),
    );
    assert.match(String(comm.body.case_ids), /parseJSON|split/);
  });

  it("listAssessmentsRpc wired on invite slug param", () => {
    const params = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "modules/invitationInvite/invitationInvite.mappable-params.iml.json"),
        "utf8",
      ),
    );
    const slug = params.find((p) => p.name === "slug");
    assert.ok(slug);
    assert.equal(slug.options, "rpc://listAssessmentsRpc");
  });
});
