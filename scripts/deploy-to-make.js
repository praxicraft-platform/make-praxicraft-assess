#!/usr/bin/env node
/**
 * Deploy local Custom App definitions to Make via make-cli sdk-* commands.
 *
 * Env: MAKE_API_KEY, MAKE_ZONE, MAKE_APP_NAME, MAKE_APP_VERSION (default 1)
 * Soft-exits 0 when secrets are missing.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function missingSecrets() {
  return ["MAKE_API_KEY", "MAKE_ZONE", "MAKE_APP_NAME"].filter(
    (k) => !process.env[k] || !String(process.env[k]).trim(),
  );
}

function runMake(args) {
  const r = spawnSync("npx", ["--yes", "@makehq/cli", ...args], {
    env: { ...process.env },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`make-cli failed (${r.status}): ${args.slice(0, 4).join(" ")}…`);
  }
  return r.stdout || "";
}

function withBodyFile(relOrObj, fn) {
  const tmp = path.join(os.tmpdir(), `make-body-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const content = typeof relOrObj === "string" ? fs.readFileSync(path.join(ROOT, relOrObj), "utf8") : JSON.stringify(relOrObj);
  fs.writeFileSync(tmp, content);
  try {
    return fn(tmp, content);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function trySections(buildArgs) {
  const names = Array.isArray(buildArgs.sections) ? buildArgs.sections : [buildArgs.sections];
  let lastErr;
  for (const section of names) {
    try {
      withBodyFile(buildArgs.bodyRel, (_tmp, body) => {
        runMake([...buildArgs.prefix, `--section=${section}`, `--body=${body}`]);
      });
      return section;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("all sections failed");
}

function main() {
  const missing = missingSecrets();
  if (missing.length) {
    console.warn(`Make secrets missing (${missing.join(", ")}) — skipping deploy.`);
    process.exit(0);
  }

  const name = process.env.MAKE_APP_NAME;
  const version = process.env.MAKE_APP_VERSION || "1";
  console.log(`Deploying to Make app ${name}@${version} (zone=${process.env.MAKE_ZONE})`);

  let hardFailures = 0;

  try {
    withBodyFile("general/base.iml.json", (_t, body) => {
      runMake([
        "sdk-apps",
        "set-section",
        `--name=${name}`,
        `--version=${version}`,
        "--section=base",
        `--body=${body}`,
      ]);
    });
    console.log("synced base");
  } catch (err) {
    console.error(`FATAL base: ${err.message}`);
    hardFailures += 1;
  }

  try {
    withBodyFile("general/common.json", (_t, body) => {
      runMake(["sdk-apps", "set-common", `--name=${name}`, `--version=${version}`, `--common=${body}`]);
    });
  } catch (err) {
    console.warn(`set-common skipped: ${err.message}`);
  }

  // Connection
  const syncConnection = () => {
    trySections({
      prefix: [
        "sdk-connections",
        "set-section",
        `--app-name=${name}`,
        `--app-version=${version}`,
        "--connection-name=apiKey",
      ],
      sections: ["params", "parameters"],
      bodyRel: "connections/apiKey/apiKey.params.iml.json",
    });
    trySections({
      prefix: [
        "sdk-connections",
        "set-section",
        `--app-name=${name}`,
        `--app-version=${version}`,
        "--connection-name=apiKey",
      ],
      sections: ["communication", "api"],
      bodyRel: "connections/apiKey/apiKey.communication.iml.json",
    });
  };

  try {
    syncConnection();
    console.log("synced connection");
  } catch {
    try {
      runMake([
        "sdk-connections",
        "create",
        `--app-name=${name}`,
        `--app-version=${version}`,
        "--type=basic",
        "--name=apiKey",
        "--label=Praxicraft Assess API",
      ]);
      syncConnection();
      console.log("created+synced connection");
    } catch (err2) {
      console.error(`FATAL connection: ${err2.message}`);
      hardFailures += 1;
    }
  }

  // Webhook
  const whFiles = {
    params: "webhooks/assessEvents/assessEvents.params.iml.json",
    communication: "webhooks/assessEvents/assessEvents.communication.iml.json",
    attach: "webhooks/assessEvents/assessEvents.attach.iml.json",
    detach: "webhooks/assessEvents/assessEvents.detach.iml.json",
  };
  const syncWebhook = () => {
    for (const [section, file] of Object.entries(whFiles)) {
      withBodyFile(file, (_t, body) => {
        runMake([
          "sdk-webhooks",
          "set-section",
          `--app-name=${name}`,
          `--app-version=${version}`,
          "--webhook-name=assessEvents",
          `--section=${section}`,
          `--body=${body}`,
        ]);
      });
    }
  };
  try {
    syncWebhook();
    console.log("synced webhook");
  } catch {
    try {
      runMake([
        "sdk-webhooks",
        "create",
        `--app-name=${name}`,
        `--app-version=${version}`,
        "--name=assessEvents",
        "--label=Assess Events",
        "--type=web",
      ]);
      syncWebhook();
      console.log("created+synced webhook");
    } catch (err2) {
      console.warn(`webhook sync failed: ${err2.message}`);
    }
  }

  const app = JSON.parse(fs.readFileSync(path.join(ROOT, "makecomapp.json"), "utf8"));
  const modules = app.components.module || {};
  let moduleOk = 0;
  let moduleFail = 0;

  for (const [modName, meta] of Object.entries(modules)) {
    try {
      try {
        runMake([
          "sdk-modules",
          "get",
          `--app-name=${name}`,
          `--app-version=${version}`,
          `--module-name=${modName}`,
        ]);
      } catch {
        runMake([
          "sdk-modules",
          "create",
          `--app-name=${name}`,
          `--app-version=${version}`,
          `--name=${modName}`,
          `--label=${meta.label || modName}`,
          `--type=${meta.moduleType || "action"}`,
        ]);
      }

      const files = meta.codeFiles || {};
      const sectionMap = {
        communication: ["api", "communication"],
        mappableParams: ["parameters", "mappable_parameters", "interface"],
        staticParams: ["epoch", "static_parameters", "parameters"],
        interface: ["interface", "output"],
        samples: ["samples", "sample"],
      };
      for (const [key, rel] of Object.entries(files)) {
        const sections = sectionMap[key] || [key];
        try {
          trySections({
            prefix: [
              "sdk-modules",
              "set-section",
              `--app-name=${name}`,
              `--app-version=${version}`,
              `--module-name=${modName}`,
            ],
            sections,
            bodyRel: rel,
          });
        } catch (e) {
          console.warn(`  ${modName}.${key}: ${e.message}`);
        }
      }
      if (meta.label) {
        try {
          const args = [
            "sdk-modules",
            "update",
            `--app-name=${name}`,
            `--app-version=${version}`,
            `--module-name=${modName}`,
            `--label=${meta.label}`,
          ];
          if (meta.description) args.push(`--description=${meta.description}`);
          runMake(args);
        } catch {
          /* optional */
        }
      }
      moduleOk += 1;
    } catch (err) {
      moduleFail += 1;
      console.warn(`module ${modName}: ${err.message}`);
    }
  }
  console.log(`modules synced ok=${moduleOk} fail=${moduleFail}`);

  const rpcs = app.components.rpc || {};
  for (const [rpcName, meta] of Object.entries(rpcs)) {
    try {
      try {
        runMake([
          "sdk-rpcs",
          "get",
          `--app-name=${name}`,
          `--app-version=${version}`,
          `--rpc-name=${rpcName}`,
        ]);
      } catch {
        runMake([
          "sdk-rpcs",
          "create",
          `--app-name=${name}`,
          `--app-version=${version}`,
          `--name=${rpcName}`,
          `--label=${meta.label || rpcName}`,
        ]);
      }
      const rel = meta.codeFiles && meta.codeFiles.communication;
      if (rel) {
        trySections({
          prefix: [
            "sdk-rpcs",
            "set-section",
            `--app-name=${name}`,
            `--app-version=${version}`,
            `--rpc-name=${rpcName}`,
          ],
          sections: ["api", "communication"],
          bodyRel: rel,
        });
      }
      console.log(`synced rpc ${rpcName}`);
    } catch (err) {
      console.warn(`rpc ${rpcName}: ${err.message}`);
    }
  }

  if (hardFailures > 0) {
    console.error(`Deploy finished with ${hardFailures} fatal error(s).`);
    process.exit(1);
  }
  console.log("Deploy finished.");
}

main();
