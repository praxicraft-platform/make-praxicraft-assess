#!/usr/bin/env node
/**
 * Deploy local Custom App definitions to Make via @makehq/cli sdk-* commands.
 *
 * Env: MAKE_API_KEY, MAKE_ZONE, MAKE_APP_NAME, MAKE_APP_VERSION (default 1)
 * Soft-exits 0 when secrets are missing.
 *
 * Flag shapes match @makehq/cli ≥1.4 (connections/webhooks omit --app-version;
 * modules require --type-id; sections use api/parameters not communication/params).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const MODULE_TYPE_IDS = {
  trigger: 1,
  action: 4,
  search: 9,
  instant_trigger: 10,
  hitl: 11,
  universal: 12,
};

function missingSecrets() {
  return ["MAKE_API_KEY", "MAKE_ZONE", "MAKE_APP_NAME"].filter(
    (k) => !process.env[k] || !String(process.env[k]).trim(),
  );
}

function runMake(args, { allowFail = false } = {}) {
  const r = spawnSync("npx", ["--yes", "@makehq/cli@1.4.0", "--output=json", ...args], {
    env: { ...process.env },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0 && !allowFail) {
    throw new Error(`make-cli failed (${r.status}): ${args.slice(0, 6).join(" ")}…`);
  }
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseJsonLoose(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const startArr = text.indexOf("[");
    const i =
      start >= 0 && (startArr < 0 || start < startArr)
        ? start
        : startArr >= 0
          ? startArr
          : -1;
    if (i < 0) return null;
    try {
      return JSON.parse(text.slice(i));
    } catch {
      return null;
    }
  }
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function setSection(prefixArgs, section, bodyObj) {
  const body = typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj);
  runMake([...prefixArgs, `--section=${section}`, `--body=${body}`]);
}

function firstNamed(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    if (obj[k] && typeof obj[k] === "object" && obj[k].name) return obj[k];
  }
  return null;
}

function listNames(payload, listKeys, itemKeys) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((x) => x && x.name).filter(Boolean);
  }
  for (const k of listKeys) {
    if (Array.isArray(payload[k])) {
      return payload[k].map((x) => x && x.name).filter(Boolean);
    }
  }
  const single = firstNamed(payload, itemKeys);
  return single ? [single.name] : [];
}

function ensureConnection(appName) {
  const listed = parseJsonLoose(runMake(["sdk-connections", "list", `--app-name=${appName}`], { allowFail: true }).stdout);
  let names = listNames(listed, ["appConnections", "connections", "data"], ["appConnection", "connection"]);
  if (!names.length) {
    const created = parseJsonLoose(
      runMake([
        "sdk-connections",
        "create",
        `--app-name=${appName}`,
        "--type=basic",
        "--label=Praxicraft Assess API",
      ]).stdout,
    );
    const row = firstNamed(created, ["appConnection", "connection"]) || created;
    if (row && row.name) names = [row.name];
    else {
      const again = parseJsonLoose(runMake(["sdk-connections", "list", `--app-name=${appName}`]).stdout);
      names = listNames(again, ["appConnections", "connections", "data"], ["appConnection", "connection"]);
    }
  }
  if (!names.length) throw new Error("Could not resolve remote connection name");
  const connectionName = names[0];
  console.log(`using connection ${connectionName}`);

  setSection(
    ["sdk-connections", "set-section", `--connection-name=${connectionName}`],
    "parameters",
    readJson("connections/apiKey/apiKey.params.iml.json"),
  );
  setSection(
    ["sdk-connections", "set-section", `--connection-name=${connectionName}`],
    "api",
    readJson("connections/apiKey/apiKey.communication.iml.json"),
  );
  return connectionName;
}

function ensureWebhook(appName) {
  const listed = parseJsonLoose(runMake(["sdk-webhooks", "list", `--app-name=${appName}`], { allowFail: true }).stdout);
  let names = listNames(listed, ["appWebhooks", "webhooks", "data"], ["appWebhook", "webhook"]);
  if (!names.length) {
    const created = parseJsonLoose(
      runMake([
        "sdk-webhooks",
        "create",
        `--app-name=${appName}`,
        "--type=web",
        "--label=Assess Events",
      ]).stdout,
    );
    const row = firstNamed(created, ["appWebhook", "webhook"]) || created;
    if (row && row.name) names = [row.name];
    else {
      const again = parseJsonLoose(runMake(["sdk-webhooks", "list", `--app-name=${appName}`]).stdout);
      names = listNames(again, ["appWebhooks", "webhooks", "data"], ["appWebhook", "webhook"]);
    }
  }
  if (!names.length) throw new Error("Could not resolve remote webhook name");
  const webhookName = names[0];
  console.log(`using webhook ${webhookName}`);

  const sections = {
    parameters: "webhooks/assessEvents/assessEvents.params.iml.json",
    api: "webhooks/assessEvents/assessEvents.communication.iml.json",
    attach: "webhooks/assessEvents/assessEvents.attach.iml.json",
    detach: "webhooks/assessEvents/assessEvents.detach.iml.json",
  };
  for (const [section, rel] of Object.entries(sections)) {
    setSection(
      ["sdk-webhooks", "set-section", `--webhook-name=${webhookName}`],
      section,
      readJson(rel),
    );
  }
  return webhookName;
}

function typeIdFor(moduleType) {
  const id = MODULE_TYPE_IDS[moduleType];
  if (!id) throw new Error(`Unknown moduleType ${moduleType}`);
  return id;
}

function syncModuleSections(appName, version, modName, files) {
  const map = {
    communication: "api",
    mappableParams: "parameters",
    staticParams: "epoch",
    interface: "interface",
    samples: "samples",
  };
  for (const [key, rel] of Object.entries(files || {})) {
    const section = map[key];
    if (!section) {
      console.warn(`  skip unknown codeFiles key ${modName}.${key}`);
      continue;
    }
    try {
      setSection(
        [
          "sdk-modules",
          "set-section",
          `--app-name=${appName}`,
          `--app-version=${version}`,
          `--module-name=${modName}`,
        ],
        section,
        readJson(rel),
      );
    } catch (err) {
      console.warn(`  ${modName}.${section}: ${err.message}`);
    }
  }
}

function updateModuleMeta(appName, version, modName, meta, connectionName, webhookName) {
  const args = [
    "sdk-modules",
    "update",
    `--app-name=${appName}`,
    `--app-version=${version}`,
    `--module-name=${modName}`,
  ];
  if (meta.label) args.push(`--label=${meta.label}`);
  if (meta.description) args.push(`--description=${meta.description}`);
  if (connectionName) args.push(`--connection=${connectionName}`);
  runMake(args);

  // CLI update has no --webhook; patch via Make REST when needed.
  if (meta.webhook && webhookName) {
    const zone = process.env.MAKE_ZONE.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${zone}/api/v2/sdk/apps/${encodeURIComponent(appName)}/${encodeURIComponent(version)}/modules/${encodeURIComponent(modName)}`;
    const r = spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "PATCH",
        url,
        "-H",
        `Authorization: Token ${process.env.MAKE_API_KEY}`,
        "-H",
        "Content-Type: application/json",
        "-H",
        "Accept: application/json",
        "-d",
        JSON.stringify({ webhook: webhookName, connection: connectionName }),
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.warn(`  ${modName} webhook link curl failed: ${r.stderr || r.stdout}`);
    } else if (/^\s*\{.*"error"/i.test(r.stdout || "") || /not found/i.test(r.stdout || "")) {
      console.warn(`  ${modName} webhook link response: ${r.stdout.slice(0, 200)}`);
    }
  }
}

function ensureModule(appName, version, modName, meta, connectionName, webhookName) {
  const got = runMake(
    [
      "sdk-modules",
      "get",
      `--app-name=${appName}`,
      `--app-version=${version}`,
      `--module-name=${modName}`,
    ],
    { allowFail: true },
  );
  if (got.status !== 0) {
    const typeId = typeIdFor(meta.moduleType || "action");
    runMake([
      "sdk-modules",
      "create",
      `--app-name=${appName}`,
      `--app-version=${version}`,
      `--name=${modName}`,
      `--type-id=${typeId}`,
      `--label=${meta.label || modName}`,
      `--description=${meta.description || meta.label || modName}`,
      "--module-init-mode=blank",
    ]);
  }
  syncModuleSections(appName, version, modName, meta.codeFiles);
  try {
    updateModuleMeta(appName, version, modName, meta, connectionName, webhookName);
  } catch (err) {
    console.warn(`  ${modName} update: ${err.message}`);
  }
}

function listAppRows(payload) {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.apps)
      ? payload.apps
      : Array.isArray(payload?.sdkApps)
        ? payload.sdkApps
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
  return arr
    .filter((a) => a && typeof a === "object" && (a.name || a.appName))
    .map((a) => ({
      name: String(a.name || a.appName),
      version: String(a.version ?? a.appVersion ?? "1"),
      label: String(a.label || a.appLabel || ""),
    }));
}

function summarizeApps(payload) {
  return listAppRows(payload).map((a) => `${a.name}@${a.version}`);
}

/**
 * Resolve MAKE_APP_NAME / MAKE_APP_VERSION against apps visible to the API key.
 * Make often suffixes the Name (e.g. praxicraft-assess-5nwwt8) even when you asked for praxicraft-assess.
 * Returns { name, version }.
 */
function ensureApp(requestedName, requestedVersion) {
  let name = requestedName;
  let version = requestedVersion;

  if (/\./.test(version) || /^v/i.test(version)) {
    console.warn(
      `WARNING: MAKE_APP_VERSION="${version}" looks like npm/semver. Make Custom App versions are usually integers like "1".`,
    );
  }

  const got = runMake(
    ["sdk-apps", "get", `--name=${name}`, `--version=${version}`],
    { allowFail: true },
  );
  if (got.status === 0) {
    console.log(`found app ${name}@${version}`);
    return { name, version };
  }

  const listed = parseJsonLoose(
    runMake(["sdk-apps", "list"], { allowFail: true }).stdout,
  );
  const rows = listAppRows(listed);
  const known = rows.map((a) => `${a.name}@${a.version}`);

  // Auto-resolve: Make appends a suffix to the Name; Label stays "Praxicraft Assess".
  let match =
    rows.find((a) => a.name === name && a.version === version) ||
    rows.find((a) => a.name === name) ||
    rows.find((a) => a.name.startsWith(`${name}-`)) ||
    rows.find((a) => a.label.toLowerCase() === "praxicraft assess") ||
    (rows.length === 1 ? rows[0] : null);

  if (match) {
    console.warn(
      `MAKE_APP_NAME/VERSION ${name}@${version} not found; using listed app ${match.name}@${match.version}` +
        (match.label ? ` (label: ${match.label})` : ""),
    );
    name = match.name;
    version = match.version;
    const again = runMake(
      ["sdk-apps", "get", `--name=${name}`, `--version=${version}`],
      { allowFail: true },
    );
    if (again.status === 0) {
      console.log(`found app ${name}@${version}`);
      return { name, version };
    }
  }

  console.error(`Unknown Make app ${requestedName}@${requestedVersion} in zone ${process.env.MAKE_ZONE}.`);
  if (known.length) {
    console.error(`Apps visible to this API key:\n  ${known.join("\n  ")}`);
  } else {
    console.error(
      "No Custom Apps visible to this API key (wrong zone, wrong token org, or none created).",
    );
  }
  console.error(
    [
      "Fix GitHub Actions secrets:",
      "  MAKE_ZONE         = host from browser URL (your org is on eu1.make.com → eu1.make.com)",
      "  MAKE_APP_NAME     = exact Name from `sdk-apps list` (often ends with a suffix like -5nwwt8), NOT the Label",
      "  MAKE_APP_VERSION  = version integer from that list row (usually 1) — NOT package.json / v0.0.2",
      "Or re-run deploy with MAKE_APP_CREATE=1 to create automatically.",
    ].join("\n"),
  );

  if (String(process.env.MAKE_APP_CREATE || "").trim() === "1") {
    console.log("MAKE_APP_CREATE=1 — creating Custom App…");
    runMake([
      "sdk-apps",
      "create",
      `--name=${requestedName}`,
      "--label=Praxicraft Assess",
      "--description=Assess Public API for Make",
      "--theme=#0D41FF",
      "--language=en",
      "--audience=global",
      "--private",
    ]);
    const after = listAppRows(
      parseJsonLoose(runMake(["sdk-apps", "list"], { allowFail: true }).stdout),
    );
    const created =
      after.find((a) => a.name === requestedName) ||
      after.find((a) => a.name.startsWith(`${requestedName}-`)) ||
      after.find((a) => a.label.toLowerCase() === "praxicraft assess");
    if (!created) {
      throw new Error("MAKE_APP_CREATE created an app but it was not visible in sdk-apps list");
    }
    console.log(`created app ${created.name}@${created.version}`);
    return { name: created.name, version: created.version };
  }

  throw new Error(`Unknown app or version (${requestedName}, ${requestedVersion})`);
}

function ensureRpc(appName, version, rpcName, meta, connectionName) {
  const got = runMake(
    [
      "sdk-rpcs",
      "get",
      `--app-name=${appName}`,
      `--app-version=${version}`,
      `--rpc-name=${rpcName}`,
    ],
    { allowFail: true },
  );
  if (got.status !== 0) {
    runMake([
      "sdk-rpcs",
      "create",
      `--app-name=${appName}`,
      `--app-version=${version}`,
      `--name=${rpcName}`,
      `--label=${meta.label || rpcName}`,
    ]);
  }
  const rel = meta.codeFiles && meta.codeFiles.communication;
  if (rel) {
    setSection(
      [
        "sdk-rpcs",
        "set-section",
        `--app-name=${appName}`,
        `--app-version=${version}`,
        `--rpc-name=${rpcName}`,
      ],
      "api",
      readJson(rel),
    );
  }
  // Best-effort connection attach via REST if CLI has no rpc update --connection
  if (connectionName) {
    const zone = process.env.MAKE_ZONE.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${zone}/api/v2/sdk/apps/${encodeURIComponent(appName)}/${encodeURIComponent(version)}/rpcs/${encodeURIComponent(rpcName)}`;
    spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "PATCH",
        url,
        "-H",
        `Authorization: Token ${process.env.MAKE_API_KEY}`,
        "-H",
        "Content-Type: application/json",
        "-d",
        JSON.stringify({ connection: connectionName, label: meta.label || rpcName }),
      ],
      { encoding: "utf8" },
    );
  }
}

function main() {
  const missing = missingSecrets();
  if (missing.length) {
    console.warn(`Make secrets missing (${missing.join(", ")}) — skipping deploy.`);
    process.exit(0);
  }

  const requestedName = process.env.MAKE_APP_NAME.trim();
  const requestedVersion = (process.env.MAKE_APP_VERSION || "1").trim();
  console.log(
    `Deploying to Make app ${requestedName}@${requestedVersion} (zone=${process.env.MAKE_ZONE})`,
  );

  let name;
  let version;
  try {
    ({ name, version } = ensureApp(requestedName, requestedVersion));
  } catch (err) {
    console.error(`FATAL app: ${err.message}`);
    process.exit(1);
  }
  console.log(`Resolved target ${name}@${version}`);

  let hardFailures = 0;

  try {
    setSection(
      ["sdk-apps", "set-section", `--name=${name}`, `--version=${version}`],
      "base",
      readJson("general/base.iml.json"),
    );
    console.log("synced base");
  } catch (err) {
    console.error(`FATAL base: ${err.message}`);
    hardFailures += 1;
  }

  try {
    const common = readJson("general/common.json");
    runMake([
      "sdk-apps",
      "set-common",
      `--name=${name}`,
      `--version=${version}`,
      `--common=${JSON.stringify(common)}`,
    ]);
  } catch (err) {
    console.warn(`set-common skipped: ${err.message}`);
  }

  let connectionName = null;
  try {
    connectionName = ensureConnection(name);
    console.log("synced connection");
  } catch (err) {
    console.error(`FATAL connection: ${err.message}`);
    hardFailures += 1;
  }

  let webhookName = null;
  try {
    webhookName = ensureWebhook(name);
    console.log("synced webhook");
  } catch (err) {
    console.warn(`webhook sync failed: ${err.message}`);
  }

  const app = readJson("makecomapp.json");
  const modules = (app.components && app.components.module) || {};
  let moduleOk = 0;
  let moduleFail = 0;

  for (const [modName, meta] of Object.entries(modules)) {
    try {
      ensureModule(name, version, modName, meta, connectionName, webhookName);
      moduleOk += 1;
    } catch (err) {
      moduleFail += 1;
      console.warn(`module ${modName}: ${err.message}`);
    }
  }
  console.log(`modules synced ok=${moduleOk} fail=${moduleFail}`);

  const rpcs = (app.components && app.components.rpc) || {};
  for (const [rpcName, meta] of Object.entries(rpcs)) {
    try {
      ensureRpc(name, version, rpcName, meta, connectionName);
      console.log(`synced rpc ${rpcName}`);
    } catch (err) {
      console.warn(`rpc ${rpcName}: ${err.message}`);
    }
  }

  if (hardFailures > 0 || moduleFail > 0) {
    console.error(
      `Deploy finished with hardFailures=${hardFailures} moduleFail=${moduleFail}.`,
    );
    process.exit(1);
  }
  console.log("Deploy finished.");
}

main();
