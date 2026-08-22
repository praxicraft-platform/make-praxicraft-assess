/**
 * Build Make module communication with safe body/qs/search patterns.
 * Prefer omit()+spread so empty optional fields are not forced as "".
 */

function extractPathKeys(path) {
  const keys = [];
  const re = /\{\{parameters\.([a-zA-Z0-9_]+)\}\}/g;
  let m;
  while ((m = re.exec(path))) keys.push(m[1]);
  return [...new Set(keys)];
}

/** Text that may be a JSON array OR comma-separated list → array. */
function listCoerceIml(paramName) {
  return (
    `{{if(length(trim(parameters.${paramName})) = 0, undefined, ` +
    `if(substring(trim(parameters.${paramName}), 0, 1) = '[', ` +
    `parseJSON(parameters.${paramName}), ` +
    `map(split(parameters.${paramName}, ','), trim)))}}`
  );
}

function buildCommunication(row) {
  const pathKeys = extractPathKeys(row.path);
  const listFields = row.listFields || [];
  const jsonFields = row.jsonFields || [];
  const jsonFieldMap = row.jsonFieldMap || {};
  const comm = {
    url: row.path,
    method: row.method,
  };

  if (row.paginated || row.qs) {
    if (pathKeys.length) {
      comm.qs = {
        "{{...}}": `{{omit(parameters, ${pathKeys.map((k) => `'${k}'`).join(", ")})}}`,
      };
    } else {
      comm.qs = { "{{...}}": "{{parameters}}" };
    }
  }

  const writes = ["POST", "PUT", "PATCH", "DELETE"].includes(row.method);
  if (writes && row.bodyMode !== "none") {
    const special = new Set([
      ...pathKeys,
      ...listFields,
      ...jsonFields,
      ...Object.values(jsonFieldMap),
    ]);
    const omitArgs = [...special].map((k) => `'${k}'`).join(", ");
    const hasParams = (row.params || []).length > 0;

    if (hasParams || listFields.length || jsonFields.length) {
      const body = {
        "{{...}}": omitArgs ? `{{omit(parameters, ${omitArgs})}}` : "{{parameters}}",
      };
      for (const f of listFields) {
        body[f] = listCoerceIml(f);
      }
      for (const f of jsonFields) {
        const apiKey = jsonFieldMap[f] || f;
        body[apiKey] =
          `{{if(length(trim(parameters.${f})) > 0, parseJSON(parameters.${f}), undefined)}}`;
      }
      comm.body = body;
      comm.type = "json";
    }
  }

  if (row.moduleType === "search") {
    comm.response = {
      output: "{{item}}",
      iterate: "{{if(body.results, body.results, emptyarray)}}",
      limit: "{{ifempty(parameters.page_size, 20)}}",
    };
    if (row.paginated) {
      comm.pagination = {
        url: "{{body.next}}",
        method: "GET",
        condition: "{{if(body.next, true, false)}}",
      };
    }
  } else {
    comm.response = { output: "{{body}}" };
  }

  return comm;
}

module.exports = { buildCommunication, extractPathKeys, listCoerceIml };
