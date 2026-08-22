#!/usr/bin/env node
/**
 * Generate Make Custom App modules + makecomapp.json from the catalog.
 * Run: node scripts/generate-modules.js
 */
const fs = require("fs");
const path = require("path");
const { CATALOG, camelModule, EVENT_OPTIONS } = require("./catalog");
const { PUBLIC_API_OPERATIONS } = require("./operations.contract");
const { buildCommunication } = require("./buildCommunication");

const ROOT = path.join(__dirname, "..");

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function paramToMake(p) {
  const out = {
    name: p.name,
    type: p.type || "text",
    label: p.label,
    required: Boolean(p.required),
  };
  if (p.help) out.help = p.help;
  if (p.default !== undefined) out.default = p.default;
  if (p.options) {
    out.options = p.options.map((o) => ({ label: o.label, value: o.value }));
  }
  if (p.rpc) {
    out.options = `rpc://${p.rpc}`;
  }
  return out;
}

function sampleInterface(sample) {
  if (!sample || typeof sample !== "object") return [];
  return Object.keys(sample).map((name) => ({
    name,
    type: typeof sample[name] === "number" ? "number" : typeof sample[name] === "boolean" ? "boolean" : "text",
    label: name,
  }));
}

function groupLabel(resource) {
  const map = {
    assessment: "Assessments",
    case: "Cases",
    invitation: "Invitations",
    pipeline: "Pipelines",
    webhook: "Webhooks",
    organisation: "Organisation",
    interview: "Interviews",
    integration: "Integrations",
  };
  return map[resource] || resource;
}

function generateCatalogModules() {
  const moduleEntries = {};
  const groups = {};

  for (const row of CATALOG) {
    const name = camelModule(row.resource, row.operation);
    const dir = path.join(ROOT, "modules", name);
    fs.mkdirSync(dir, { recursive: true });

    writeJson(path.join(dir, `${name}.communication.iml.json`), buildCommunication(row));
    writeJson(
      path.join(dir, `${name}.mappable-params.iml.json`),
      (row.params || []).map(paramToMake),
    );
    writeJson(path.join(dir, `${name}.interface.iml.json`), sampleInterface(row.sample));
    writeJson(path.join(dir, `${name}.samples.iml.json`), row.sample || {});

    const group = groupLabel(row.resource);
    if (!groups[group]) groups[group] = [];
    groups[group].push(name);

    moduleEntries[name] = {
      moduleType: row.moduleType,
      label: row.label,
      description: row.description,
      connection: "apiKey",
      codeFiles: {
        communication: `modules/${name}/${name}.communication.iml.json`,
        mappableParams: `modules/${name}/${name}.mappable-params.iml.json`,
        interface: `modules/${name}/${name}.interface.iml.json`,
        samples: `modules/${name}/${name}.samples.iml.json`,
      },
    };
    if (row.moduleType === "action") {
      moduleEntries[name].actionCrud =
        row.method === "GET" ? "read" : row.method === "DELETE" ? "delete" : row.operation.includes("create") || row.operation === "invite" || row.operation === "enroll" ? "create" : "update";
    }
  }

  return { moduleEntries, groups };
}

function writeStaticCore(moduleEntries, groups) {
  // base
  writeJson(path.join(ROOT, "general/base.iml.json"), {
    baseUrl: "{{connection.baseUrl}}/api/v1/public",
    headers: {
      Authorization: "Bearer {{connection.apiKey}}",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    response: {
      error: {
        message: "[{{statusCode}}] {{ifempty(body.message, ifempty(body.error.message, body.error))}}",
        type: "RuntimeError",
        401: {
          type: "ConnectionError",
          message: "Invalid Assess API key. Create a key under Assess → Developer → API Keys.",
        },
        403: {
          type: "RuntimeError",
          message: "Forbidden — check API key scopes.",
        },
        429: {
          type: "RateLimitError",
          message: "Rate limit exceeded. Wait and retry.",
        },
      },
    },
    log: {
      sanitize: ["request.headers.authorization"],
    },
  });

  writeJson(path.join(ROOT, "general/common.json"), {});

  // connection
  writeJson(path.join(ROOT, "connections/apiKey/apiKey.params.iml.json"), [
    {
      name: "apiKey",
      type: "password",
      label: "API Key",
      help: "Assess → Developer → API Keys. Keys start with ct_live_ or ct_test_.",
      required: true,
      editable: true,
    },
    {
      name: "baseUrl",
      type: "url",
      label: "Base URL",
      help: "Leave as https://assess.praxicraft.com unless you use a custom host.",
      required: false,
      editable: true,
      default: "https://assess.praxicraft.com",
    },
  ]);

  writeJson(path.join(ROOT, "connections/apiKey/apiKey.communication.iml.json"), {
    url: "{{ifempty(parameters.baseUrl, 'https://assess.praxicraft.com')}}/api/v1/public/org/",
    method: "GET",
    headers: {
      Authorization: "Bearer {{parameters.apiKey}}",
      Accept: "application/json",
    },
    response: {
      data: {
        apiKey: "{{parameters.apiKey}}",
        baseUrl: "{{ifempty(parameters.baseUrl, 'https://assess.praxicraft.com')}}",
      },
      metadata: {
        type: "text",
        value: "{{ifempty(body.name, body.slug)}}",
      },
      error: {
        message: "[{{statusCode}}] {{ifempty(body.message, 'Connection failed')}}",
      },
    },
    log: {
      sanitize: ["request.headers.authorization"],
    },
  });

  // webhook assessEvents — store id + secret; create then test (Assess requires verify)
  const wh = path.join(ROOT, "webhooks/assessEvents");
  writeJson(path.join(wh, "assessEvents.params.iml.json"), [
    {
      name: "event",
      type: "select",
      label: "Event",
      required: true,
      options: EVENT_OPTIONS,
      help: "One event per subscription. Make registers an Assess REST Hook when the scenario is activated.",
    },
  ]);
  // Filter webhook.test from scenario runs but always ACK 200 so Assess can verify.
  writeJson(path.join(wh, "assessEvents.communication.iml.json"), {
    respond: {
      status: 200,
      type: "json",
      body: { ok: true },
    },
    response: {
      output: "{{body}}",
      // Drop internal test pings; still return 200 via respond
      condition: "{{if(body.event = 'webhook.test', false, true)}}",
    },
  });
  // Sequential attach: create webhook, persist id+secret_key, then POST /test/ to activate.
  writeJson(path.join(wh, "assessEvents.attach.iml.json"), [
    {
      url: "/webhooks/create/",
      method: "POST",
      type: "json",
      body: {
        url: "{{webhook.url}}",
        events: ["{{parameters.event}}"],
        name: "Make: {{parameters.event}}",
      },
      response: {
        temp: {
          id: "{{body.id}}",
          secret_key: "{{body.secret_key}}",
        },
        data: {
          id: "{{body.id}}",
          secret_key: "{{body.secret_key}}",
        },
      },
    },
    {
      url: "/webhooks/{{temp.id}}/test/",
      method: "POST",
      response: {
        data: {
          id: "{{temp.id}}",
          secret_key: "{{temp.secret_key}}",
        },
      },
    },
  ]);
  writeJson(path.join(wh, "assessEvents.detach.iml.json"), {
    url: "/webhooks/{{webhook.id}}/",
    method: "DELETE",
    // 404 is fine if already removed
    response: {
      error: {
        404: { type: "Ignore", message: "Webhook already deleted" },
      },
    },
  });

  // Instant trigger — event lives on webhook params; keep static mirror for UI clarity
  const watch = "watchAssessEvent";
  const watchDir = path.join(ROOT, "modules", watch);
  fs.mkdirSync(watchDir, { recursive: true });
  writeJson(path.join(watchDir, `${watch}.communication.iml.json`), {
    response: { output: "{{body}}" },
  });
  writeJson(path.join(watchDir, `${watch}.mappable-params.iml.json`), []);
  // Event is configured on the webhook component (shared with attach)
  writeJson(path.join(watchDir, `${watch}.static-params.iml.json`), []);
  writeJson(path.join(watchDir, `${watch}.interface.iml.json`), [
    { name: "id", type: "text", label: "id" },
    { name: "event", type: "text", label: "event" },
    { name: "created_at", type: "text", label: "created_at" },
    { name: "data", type: "collection", label: "data" },
  ]);
  writeJson(path.join(watchDir, `${watch}.samples.iml.json`), {
    id: "evt_sample",
    event: "candidate.passed",
    created_at: "2026-01-15T12:00:00Z",
    data: {
      invite_token: "inv_abc",
      email: "ada@example.com",
      passed: true,
      overall_score: 82,
    },
  });

  moduleEntries[watch] = {
    moduleType: "instant_trigger",
    label: "Watch Assess Event",
    description:
      "Triggers when Assess sends a signed webhook (candidate passed, assessment completed, interview finished, and more).",
    webhook: "assessEvents",
    connection: "apiKey",
    codeFiles: {
      communication: `modules/${watch}/${watch}.communication.iml.json`,
      mappableParams: `modules/${watch}/${watch}.mappable-params.iml.json`,
      staticParams: `modules/${watch}/${watch}.static-params.iml.json`,
      interface: `modules/${watch}/${watch}.interface.iml.json`,
      samples: `modules/${watch}/${watch}.samples.iml.json`,
    },
  };
  if (!groups.Triggers) groups.Triggers = [];
  groups.Triggers.unshift(watch);

  // universal API call
  const uni = "makeAnApiCall";
  const uniDir = path.join(ROOT, "modules", uni);
  fs.mkdirSync(uniDir, { recursive: true });
  writeJson(path.join(uniDir, `${uni}.communication.iml.json`), {
    url: "/{{parameters.path}}",
    method: "{{parameters.method}}",
    qs: "{{parameters.query}}",
    body: "{{parameters.body}}",
    type: "json",
    response: {
      output: {
        statusCode: "{{statusCode}}",
        body: "{{body}}",
      },
    },
  });
  writeJson(path.join(uniDir, `${uni}.mappable-params.iml.json`), [
    {
      name: "path",
      type: "text",
      label: "Path",
      required: true,
      help: "Relative to /api/v1/public, e.g. assessments/ or org/",
    },
    {
      name: "method",
      type: "select",
      label: "Method",
      required: true,
      default: "GET",
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "PATCH", value: "PATCH" },
        { label: "DELETE", value: "DELETE" },
      ],
    },
    { name: "query", type: "collection", label: "Query String", spec: [{ name: "key", type: "text" }, { name: "value", type: "text" }] },
    { name: "body", type: "any", label: "Body" },
  ]);
  writeJson(path.join(uniDir, `${uni}.interface.iml.json`), [
    { name: "statusCode", type: "number", label: "statusCode" },
    { name: "body", type: "any", label: "body" },
  ]);
  writeJson(path.join(uniDir, `${uni}.samples.iml.json`), { statusCode: 200, body: {} });
  moduleEntries[uni] = {
    moduleType: "universal",
    label: "Make an API Call",
    description: "Performs an arbitrary authorized Public API call.",
    connection: "apiKey",
    codeFiles: {
      communication: `modules/${uni}/${uni}.communication.iml.json`,
      mappableParams: `modules/${uni}/${uni}.mappable-params.iml.json`,
      interface: `modules/${uni}/${uni}.interface.iml.json`,
      samples: `modules/${uni}/${uni}.samples.iml.json`,
    },
  };
  if (!groups.Advanced) groups.Advanced = [];
  groups.Advanced.push(uni);

  // RPCs
  const rpcs = {
    listAssessmentsRpc: {
      label: "List Assessments",
      path: "/assessments/",
      labelField: "title",
      valueField: "slug",
    },
    listPipelinesRpc: {
      label: "List Pipelines",
      path: "/pipelines/",
      labelField: "name",
      valueField: "slug",
    },
    listInvitationsRpc: {
      label: "List Invitations",
      path: "/invites/",
      labelField: "email",
      valueField: "invite_token",
    },
  };
  const rpcEntries = {};
  for (const [rpcName, meta] of Object.entries(rpcs)) {
    const dir = path.join(ROOT, "rpcs", rpcName);
    fs.mkdirSync(dir, { recursive: true });
    writeJson(path.join(dir, `${rpcName}.communication.iml.json`), {
      url: meta.path,
      method: "GET",
      qs: { page_size: 100 },
      response: {
        label: `{{item.${meta.labelField}}}`,
        value: `{{item.${meta.valueField}}}`,
        iterate: "{{body.results}}",
      },
    });
    rpcEntries[rpcName] = {
      label: meta.label,
      connection: "apiKey",
      codeFiles: {
        communication: `rpcs/${rpcName}/${rpcName}.communication.iml.json`,
      },
    };
  }

  // groups.json — Make format: array of { label, modules }
  const groupsJson = Object.entries(groups).map(([label, modules]) => ({
    label,
    modules,
  }));
  writeJson(path.join(ROOT, "modules/groups.json"), groupsJson);

  // makecomapp.json
  const moduleIdMapping = Object.keys(moduleEntries).map((local) => ({ local, remote: local }));
  const rpcIdMapping = Object.keys(rpcEntries).map((local) => ({ local, remote: local }));

  const makecomapp = {
    fileVersion: 1,
    generalCodeFiles: {
      base: "general/base.iml.json",
      common: "general/common.json",
      readme: "README.md",
      groups: "modules/groups.json",
    },
    components: {
      connection: {
        apiKey: {
          label: "Praxicraft Assess API",
          codeFiles: {
            communication: "connections/apiKey/apiKey.communication.iml.json",
            params: "connections/apiKey/apiKey.params.iml.json",
          },
        },
      },
      webhook: {
        assessEvents: {
          codeFiles: {
            communication: "webhooks/assessEvents/assessEvents.communication.iml.json",
            params: "webhooks/assessEvents/assessEvents.params.iml.json",
            attach: "webhooks/assessEvents/assessEvents.attach.iml.json",
            detach: "webhooks/assessEvents/assessEvents.detach.iml.json",
          },
        },
      },
      module: moduleEntries,
      rpc: rpcEntries,
    },
    origins: [
      {
        label: "Production",
        baseUrl: "https://eu2.make.com/api",
        appId: "praxicraft-assess",
        appVersion: 1,
        apikeyFile: ".secrets/apikey",
        idMapping: {
          connection: [{ local: "apiKey", remote: "apiKey" }],
          module: moduleIdMapping,
          function: [],
          rpc: rpcIdMapping,
          webhook: [{ local: "assessEvents", remote: "assessEvents" }],
        },
      },
    ],
  };
  writeJson(path.join(ROOT, "makecomapp.json"), makecomapp);

  return {
    catalogModules: CATALOG.length,
    totalModules: Object.keys(moduleEntries).length,
    ops: PUBLIC_API_OPERATIONS.length,
  };
}

function main() {
  const missing = [];
  for (const op of PUBLIC_API_OPERATIONS) {
    const found = CATALOG.find((c) => c.resource === op.resource && c.operation === op.operation);
    if (!found) missing.push(`${op.resource}.${op.operation}`);
  }
  if (missing.length) {
    console.error("Catalog missing ops:", missing.join(", "));
    process.exit(1);
  }

  const { moduleEntries, groups } = generateCatalogModules();
  const stats = writeStaticCore(moduleEntries, groups);
  console.log(
    `Generated ${stats.catalogModules} catalog modules (+ trigger/universal) = ${stats.totalModules} total; contract ops=${stats.ops}`,
  );
}

main();
