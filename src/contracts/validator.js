/* =========================================================================
   Runtime Validator
   ========================================================================= */

function jsType(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

function typeOk(v, t) {
  switch (t) {
    case "string": return typeof v === "string";
    case "int":    return typeof v === "number" && Number.isInteger(v);
    case "float":  return typeof v === "number" && isFinite(v);
    case "bool":   return typeof v === "boolean";
    case "any":
    case "json":   return true;
    default:       return false;
  }
}

export function validateBody(body, c) {
  const out = [];
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    out.push({ path: "$", sev: "error", msg: "request body must be a JSON object" });
    return out;
  }
  const known = new Set(c.fields.map(f => f.name));
  for (const k of Object.keys(body)) {
    if (!known.has(k)) out.push({ path: "$." + k, sev: "warn", msg: `unknown field "${k}" is not part of ${c.name}` });
  }
  for (const f of c.fields) {
    const p = "$." + f.name;
    const v = body[f.name];

    if (v === undefined || v === null) {
      if (!f.optional && f.def === undefined) out.push({ path: p, sev: "error", msg: `missing required field "${f.name}"` });
      continue;
    }

    if (f.array) {
      if (!Array.isArray(v)) { out.push({ path: p, sev: "error", msg: `expected ${f.type}[], received ${jsType(v)}` }); continue; }
      v.forEach((item, i) => {
        if (!typeOk(item, f.type)) out.push({ path: `${p}[${i}]`, sev: "error", msg: `expected ${f.type}, received ${jsType(item)}` });
      });
    } else if (!typeOk(v, f.type)) {
      out.push({ path: p, sev: "error", msg: `expected ${f.type}, received ${jsType(v)}` });
      continue;
    }

    for (const d of f.decos) {
      const args = d.args.map(a => (isNaN(parseFloat(a)) ? a.replace(/^["']|["']$/g, "") : parseFloat(a)));
      const a0 = args[0], a1 = args[1];
      switch (d.name) {
        case "min":
          if (typeof v === "string" && v.length < a0) out.push({ path: p, sev: "error", msg: `length ${v.length} < min ${a0}` });
          else if (typeof v === "number" && v < a0) out.push({ path: p, sev: "error", msg: `value ${v} < min ${a0}` });
          break;
        case "max":
          if (typeof v === "string" && v.length > a0) out.push({ path: p, sev: "error", msg: `length ${v.length} > max ${a0}` });
          else if (typeof v === "number" && v > a0) out.push({ path: p, sev: "error", msg: `value ${v} > max ${a0}` });
          break;
        case "range":
          if (typeof v === "number" && (v < a0 || v > a1))
            out.push({ path: p, sev: "error", msg: `value ${v} outside range [${a0}, ${a1}]` });
          break;
        case "maxItems":
          if (Array.isArray(v) && v.length > a0)
            out.push({ path: p, sev: "error", msg: `array length ${v.length} > maxItems ${a0}` });
          break;
        case "pattern":
          try { if (typeof v === "string" && !new RegExp(a0).test(v)) out.push({ path: p, sev: "error", msg: `"${v}" does not match /${a0}/` }); }
          catch (_) { out.push({ path: p, sev: "warn", msg: `invalid @pattern regex "${a0}"` }); }
          break;
        case "enum":
          if (!args.includes(v)) out.push({ path: p, sev: "error", msg: `value must be one of [${args.join(", ")}]` });
          break;
        default:
          out.push({ path: p, sev: "warn", msg: `unknown decorator @${d.name} ignored` });
      }
    }
  }
  return out;
}